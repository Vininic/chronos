import ExcelJS from "exceljs";
import type { ScheduleData } from "./types";
import { DAY_LABELS_LONG, durationMin, fmtDur, timeToMinutes } from "./types";
import type { Locale } from "@/lib/i18n/dictionaries";

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ────────────────────────────────────────────────────────────────────────────
 * Colour resolution — mirrors safeKindStyle / TAILWIND_TO_HEX (widgets.tsx) but
 * kept self-contained so this module stays free of React imports.
 * ──────────────────────────────────────────────────────────────────────────── */
const TONE_HEX: Record<string, string> = {
  bronze: "d97706", midnight: "4f46e5", "primary-glow": "8b5cf6", neutral: "94a3b8",
  sky: "0ea5e9", violet: "8b5cf6", coral: "f43f5e", mint: "34d399", peach: "fbbf24",
  amber: "f59e0b", slate: "64748b", lime: "84cc16", rose: "fb7185", emerald: "10b981",
  indigo: "6366f1", chartreuse: "84cc16",
};
const DEFAULT_TONES = ["sky", "violet", "coral", "mint", "peach", "amber", "emerald", "indigo", "rose", "lime"];

function pickDefaultTone(kind: string): string {
  let hash = 0;
  for (let i = 0; i < kind.length; i++) hash = ((hash << 5) - hash) + kind.charCodeAt(i) | 0;
  return DEFAULT_TONES[Math.abs(hash) % DEFAULT_TONES.length];
}

/** Normalise any colour string to a 6-char hex (no leading #), or null. */
function hex6(input?: string): string | null {
  if (!input) return null;
  const c = input.trim();
  const rgb = c.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i) ?? c.match(/^(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})$/);
  if (rgb) {
    return [rgb[1], rgb[2], rgb[3]]
      .map((n) => Math.max(0, Math.min(255, parseInt(n, 10))).toString(16).padStart(2, "0"))
      .join("");
  }
  const h = c.replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(h)) return h.split("").map((ch) => ch + ch).join("").toLowerCase();
  if (/^[0-9a-fA-F]{6}$/.test(h)) return h.toLowerCase();
  return null;
}

function resolveKindHex(kind: string, categories: ScheduleData["categories"]): string {
  if (kind === "sleep") return "818cf8";
  const cat = categories.find((c) => c.id === kind);
  const custom = hex6(cat?.color);
  if (custom) return custom;
  const tone = cat?.tone && TONE_HEX[cat.tone] ? cat.tone : cat ? pickDefaultTone(kind) : null;
  if (tone && TONE_HEX[tone]) return TONE_HEX[tone];
  return "6b7280";
}

const argb = (h: string) => `FF${h}`;
function readableText(h: string): string {
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.62 ? "FF1A1A1A" : "FFFFFFFF";
}
function fmtClock(min: number): string {
  const h = Math.floor(min / 60), m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Localised labels (kept inline so the module needs no I18nProvider).
 * ──────────────────────────────────────────────────────────────────────────── */
function labels(locale: Locale) {
  const pt = locale === "pt";
  return {
    daysShort: pt ? ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    sheet: {
      planner: pt ? "Planner Semanal" : "Day Planner",
      blockTypes: pt ? "Tipos de Bloco" : "Block Types",
      goals: pt ? "Metas" : "Goals",
      programs: pt ? "Planos" : "Workplans",
      routine: pt ? "Rotina" : "Routine",
      commitments: pt ? "Compromissos" : "Commitments",
      categories: pt ? "Categorias" : "Categories",
      meta: pt ? "Metadados" : "Metadata",
    },
    h: {
      time: pt ? "Hora" : "Time",
      day: pt ? "Dia" : "Day",
      dayNum: pt ? "Nº dia" : "Day #",
      start: pt ? "Início" : "Start",
      end: pt ? "Fim" : "End",
      duration: pt ? "Duração" : "Duration",
      category: pt ? "Categoria" : "Category",
      title: pt ? "Título" : "Title",
      notes: pt ? "Notas" : "Notes",
      date: pt ? "Data" : "Date",
      color: pt ? "Cor" : "Color",
      label: pt ? "Rótulo" : "Label",
      tone: pt ? "Tom" : "Tone",
      description: pt ? "Descrição" : "Description",
      kind: pt ? "Tipo" : "Kind",
      target: pt ? "Meta" : "Target",
      unit: pt ? "Unidade" : "Unit",
      period: pt ? "Período" : "Period",
      deadline: pt ? "Prazo" : "Deadline",
      weight: pt ? "Peso" : "Weight",
      key: pt ? "Campo" : "Field",
      value: pt ? "Valor" : "Value",
    },
    meta: {
      format: pt ? "Formato Chronos" : "Chronos format",
      owner: pt ? "Responsável" : "Owner",
      cycle: pt ? "Ciclo" : "Cycle",
      week: pt ? "Semana" : "Week",
      workday: pt ? "Expediente" : "Workday",
      score: pt ? "Pontuação" : "Composition score",
      exported: pt ? "Exportado em" : "Exported",
    },
  };
}

/** Marker written into the Metadata sheet so re-imports can be recognised. */
export const CHRONOS_XLSX_FORMAT = "chronos-xlsx-v1";

const THIN = { style: "thin" as const, color: { argb: "FFD9D9D9" } };
const HEADER_FILL = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FF1F2937" } };
const HEADER_FONT = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };

function styleHeaderRow(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = { top: THIN, bottom: THIN, left: THIN, right: THIN };
  });
}

export function buildStyledWorkbook(data: ScheduleData, locale: Locale = "en"): ExcelJS.Workbook {
  const L = labels(locale);
  const wb = new ExcelJS.Workbook();
  wb.creator = "Chronos";
  wb.created = new Date();

  /* ── 1. Day Planner: a coloured weekly grid (the "bloquinhos") ──────────── */
  const planner = wb.addWorksheet(L.sheet.planner, { views: [{ state: "frozen", xSplit: 1, ySplit: 1 }] });
  const SLOT = 30;
  const starts = data.routine.map((r) => timeToMinutes(r.start));
  const ends = data.routine.map((r) => timeToMinutes(r.end === "24:00" ? "24:00" : r.end));
  let gridStart = starts.length ? Math.min(...starts) : timeToMinutes(data.meta.workdayStart);
  let gridEnd = ends.length ? Math.max(...ends.map((e) => (e === 0 ? 24 * 60 : e))) : timeToMinutes(data.meta.workdayEnd);
  gridStart = Math.floor(gridStart / SLOT) * SLOT;
  gridEnd = Math.ceil(gridEnd / SLOT) * SLOT;
  if (gridEnd <= gridStart) { gridStart = 8 * 60; gridEnd = 22 * 60; }
  const slotCount = (gridEnd - gridStart) / SLOT;

  planner.getColumn(1).width = 9;
  for (let d = 0; d < 7; d++) planner.getColumn(2 + d).width = 18;

  const headerRow = planner.getRow(1);
  headerRow.getCell(1).value = L.h.time;
  for (let d = 0; d < 7; d++) headerRow.getCell(2 + d).value = L.daysShort[d];
  styleHeaderRow(headerRow);
  headerRow.height = 20;

  for (let i = 0; i < slotCount; i++) {
    const row = planner.getRow(2 + i);
    row.height = 16;
    const timeCell = row.getCell(1);
    timeCell.value = fmtClock(gridStart + i * SLOT);
    timeCell.font = { size: 9, color: { argb: "FF6B7280" } };
    timeCell.alignment = { vertical: "middle", horizontal: "right" };
    for (let d = 0; d < 7; d++) {
      const cell = row.getCell(2 + d);
      cell.border = { top: THIN, bottom: THIN, left: THIN, right: THIN };
    }
  }

  const occupied = new Set<string>(); // `${day}:${slot}` already painted
  const sortedRoutine = [...data.routine].sort((a, b) => a.day - b.day || a.start.localeCompare(b.start));
  for (const r of sortedRoutine) {
    const col = 2 + r.day;
    const bStart = Math.max(gridStart, timeToMinutes(r.start));
    const rawEnd = timeToMinutes(r.end);
    const bEnd = Math.min(gridEnd, rawEnd === 0 ? 24 * 60 : rawEnd);
    if (bEnd <= bStart) continue;
    const startSlot = Math.round((bStart - gridStart) / SLOT);
    const endSlot = Math.max(startSlot + 1, Math.round((bEnd - gridStart) / SLOT));
    // Skip if any slot is already painted (overlap) — keep the earlier block.
    let clash = false;
    for (let s = startSlot; s < endSlot; s++) if (occupied.has(`${r.day}:${s}`)) { clash = true; break; }
    if (clash) continue;
    for (let s = startSlot; s < endSlot; s++) occupied.add(`${r.day}:${s}`);

    const hex = resolveKindHex(r.kind, data.categories);
    const fill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: argb(hex) } };
    const font = { color: { argb: readableText(hex) }, size: 9, bold: true };
    const topRow = 2 + startSlot;
    const bottomRow = 2 + endSlot - 1;
    for (let rr = topRow; rr <= bottomRow; rr++) {
      const cell = planner.getRow(rr).getCell(col);
      cell.fill = fill;
      cell.border = { top: THIN, bottom: THIN, left: THIN, right: THIN };
    }
    const top = planner.getRow(topRow).getCell(col);
    top.value = r.titleCustom ?? r.title;
    top.font = font;
    top.alignment = { vertical: "top", horizontal: "left", wrapText: true };
    if (bottomRow > topRow) {
      try { planner.mergeCells(topRow, col, bottomRow, col); } catch { /* overlap guard */ }
    }
  }

  /* ── 2. Block Types legend ──────────────────────────────────────────────── */
  const bt = wb.addWorksheet(L.sheet.blockTypes);
  bt.columns = [
    { header: L.h.color, key: "color", width: 10 },
    { header: L.h.category, key: "id", width: 16 },
    { header: L.h.label, key: "label", width: 22 },
    { header: L.h.tone, key: "tone", width: 14 },
    { header: L.h.description, key: "description", width: 46 },
  ];
  styleHeaderRow(bt.getRow(1));
  for (const c of data.categories) {
    const hex = resolveKindHex(c.id, data.categories);
    const row = bt.addRow({ color: "", id: c.id, label: c.label, tone: c.tone ?? "", description: c.description ?? "" });
    row.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(hex) } };
    row.getCell(1).value = `#${hex}`;
    row.getCell(1).font = { color: { argb: readableText(hex) }, size: 9 };
    row.getCell(1).alignment = { horizontal: "center" };
  }

  /* ── 3. Goals legend ────────────────────────────────────────────────────── */
  const goals = wb.addWorksheet(L.sheet.goals);
  goals.columns = [
    { header: L.h.title, key: "title", width: 28 },
    { header: L.h.kind, key: "kind", width: 12 },
    { header: L.h.target, key: "target", width: 12 },
    { header: L.h.unit, key: "unit", width: 12 },
    { header: L.h.period, key: "period", width: 12 },
    { header: L.h.deadline, key: "deadline", width: 14 },
    { header: L.h.weight, key: "weight", width: 10 },
    { header: L.h.category, key: "category", width: 16 },
    { header: L.h.description, key: "description", width: 40 },
  ];
  styleHeaderRow(goals.getRow(1));
  for (const g of data.goals ?? []) {
    const target = g.kind === "duration" ? fmtDur(g.target) : String(g.target);
    goals.addRow({
      title: g.title, kind: g.kind, target,
      unit: g.kind === "duration" ? "" : (g.unit ?? ""),
      period: g.period, deadline: g.deadline ?? "", weight: g.weight,
      category: g.categoryId ?? "", description: g.description ?? "",
    });
  }

  /* ── 4. Workplans (reusable presets) ────────────────────────────────────── */
  const programs = wb.addWorksheet(L.sheet.programs);
  programs.columns = [
    { header: L.h.title, key: "title", width: 28 },
    { header: L.h.category, key: "kind", width: 16 },
    { header: L.h.duration, key: "duration", width: 12 },
    { header: L.h.notes, key: "notes", width: 46 },
  ];
  styleHeaderRow(programs.getRow(1));
  for (const p of data.presets ?? []) {
    programs.addRow({ title: p.titleCustom ?? p.title, kind: p.kind, duration: fmtDur(p.duration), notes: p.notes ?? "" });
  }

  /* ── 5. Routine (machine-readable, drives round-trip import) ─────────────── */
  const routine = wb.addWorksheet(L.sheet.routine);
  routine.columns = [
    { header: L.h.dayNum, key: "dayNum", width: 8 },
    { header: L.h.day, key: "day", width: 12 },
    { header: L.h.start, key: "start", width: 8 },
    { header: L.h.end, key: "end", width: 8 },
    { header: L.h.duration, key: "duration", width: 10 },
    { header: L.h.category, key: "category", width: 14 },
    { header: L.h.title, key: "title", width: 40 },
    { header: L.h.notes, key: "notes", width: 30 },
  ];
  styleHeaderRow(routine.getRow(1));
  for (const r of sortedRoutine) {
    routine.addRow({
      dayNum: r.day, day: DAY_LABELS_LONG[r.day], start: r.start, end: r.end,
      duration: fmtDur(durationMin(r.start, r.end)), category: r.kind,
      title: r.titleCustom ?? r.title, notes: r.notes ?? "",
    });
  }

  /* ── 6. Commitments (machine-readable) ──────────────────────────────────── */
  const commitments = wb.addWorksheet(L.sheet.commitments);
  commitments.columns = [
    { header: L.h.date, key: "date", width: 12 },
    { header: L.h.start, key: "start", width: 8 },
    { header: L.h.end, key: "end", width: 8 },
    { header: L.h.duration, key: "duration", width: 10 },
    { header: L.h.category, key: "category", width: 14 },
    { header: L.h.title, key: "title", width: 40 },
    { header: L.h.notes, key: "notes", width: 30 },
  ];
  styleHeaderRow(commitments.getRow(1));
  for (const c of [...data.commitments].sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start))) {
    commitments.addRow({
      date: c.date, start: c.start, end: c.end, duration: fmtDur(durationMin(c.start, c.end)),
      category: c.kind, title: c.titleCustom ?? c.title, notes: c.notes ?? "",
    });
  }

  /* ── 7. Categories (machine-readable) ───────────────────────────────────── */
  const cats = wb.addWorksheet(L.sheet.categories);
  cats.columns = [
    { header: L.h.category, key: "id", width: 16 },
    { header: L.h.label, key: "label", width: 22 },
    { header: L.h.tone, key: "tone", width: 14 },
    { header: L.h.color, key: "color", width: 12 },
    { header: L.h.description, key: "description", width: 46 },
  ];
  styleHeaderRow(cats.getRow(1));
  for (const c of data.categories) {
    cats.addRow({ id: c.id, label: c.label, tone: c.tone ?? "", color: c.color ?? "", description: c.description ?? "" });
  }

  /* ── 8. Metadata (carries the round-trip marker) ────────────────────────── */
  const meta = wb.addWorksheet(L.sheet.meta);
  meta.columns = [
    { header: L.h.key, key: "key", width: 22 },
    { header: L.h.value, key: "value", width: 44 },
  ];
  styleHeaderRow(meta.getRow(1));
  meta.addRow({ key: L.meta.format, value: CHRONOS_XLSX_FORMAT });
  meta.addRow({ key: L.meta.owner, value: data.meta.owner });
  meta.addRow({ key: L.meta.cycle, value: `${data.meta.cycle.name} #${data.meta.cycle.number}` });
  meta.addRow({ key: L.meta.week, value: data.meta.cycle.week });
  meta.addRow({ key: L.meta.workday, value: `${data.meta.workdayStart}–${data.meta.workdayEnd}` });
  meta.addRow({ key: L.meta.score, value: data.ledger.compositionScore });
  meta.addRow({ key: L.meta.exported, value: new Date().toISOString() });

  return wb;
}

export async function exportToXLSX(data: ScheduleData, filename = "chronos-schedule.xlsx", locale: Locale = "en") {
  const wb = buildStyledWorkbook(data, locale);
  const buf = await wb.xlsx.writeBuffer();
  download(
    new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    filename,
  );
}

/* ICS export — recurring routine (RRULE) + one-time commitments. */
function pad(n: number) { return String(n).padStart(2, "0"); }
function fmtICSDate(d: Date) {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
}
function nextWeekdayOnOrAfter(base: Date, weekday: number) {
  const d = new Date(base);
  const diff = (weekday - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff);
  return d;
}
function localDateTime(date: Date, time: string): Date {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(date);
  d.setHours(h, m, 0, 0);
  return d;
}
const BYDAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

export function buildICS(data: ScheduleData): string {
  const now = new Date();
  const stamp = fmtICSDate(now);
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Chronos//Olympus Suite//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Chronos Schedule",
  ];

  for (const r of data.routine) {
    const firstDate = nextWeekdayOnOrAfter(now, r.day);
    const dtStart = localDateTime(firstDate, r.start);
    const dtEnd = localDateTime(firstDate, r.end);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${r.id}@chronos.local`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${fmtICSDate(dtStart)}`,
      `DTEND:${fmtICSDate(dtEnd)}`,
      `RRULE:FREQ=WEEKLY;BYDAY=${BYDAY[r.day]}`,
      `SUMMARY:${escapeICS(r.title)}`,
      `CATEGORIES:${r.kind}`,
      "END:VEVENT",
    );
  }
  for (const c of data.commitments) {
    const [y, mo, d] = c.date.split("-").map(Number);
    const base = new Date(y, mo - 1, d);
    const dtStart = localDateTime(base, c.start);
    const dtEnd = localDateTime(base, c.end);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${c.id}@chronos.local`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${fmtICSDate(dtStart)}`,
      `DTEND:${fmtICSDate(dtEnd)}`,
      `SUMMARY:${escapeICS(c.title)}`,
      `CATEGORIES:${c.kind}`,
      c.notes ? `DESCRIPTION:${escapeICS(c.notes)}` : "",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.filter(Boolean).join("\r\n");
}

export function exportToICS(data: ScheduleData, filename = "chronos-schedule.ics") {
  download(new Blob([buildICS(data)], { type: "text/calendar;charset=utf-8" }), filename);
}

function escapeICS(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export function serializeScheduleJSON(data: ScheduleData): string {
  return JSON.stringify(data, null, 2);
}

export function exportToJSON(data: ScheduleData, filename = "chronos-schedule.json") {
  download(new Blob([serializeScheduleJSON(data)], { type: "application/json" }), filename);
}
