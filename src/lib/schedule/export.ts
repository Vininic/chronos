import * as XLSX from "xlsx";
import type { ScheduleData } from "./types";
import { DAY_LABELS_LONG, durationMin, fmtDur } from "./types";
import type { Locale } from "@/lib/i18n/dictionaries";
import { DICTIONARIES } from "@/lib/i18n/dictionaries";

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

export function exportToXLSX(data: ScheduleData, filename = "chronos-schedule.xlsx", locale: Locale = "en") {
  const dict = DICTIONARIES[locale];
  const headers = dict.chronos.store.export.headers;
  const sheets = dict.chronos.store.export.sheets;
  const wb = XLSX.utils.book_new();

  // Weekly Routine
  const routineRows = [...data.routine]
    .sort((a, b) => a.day - b.day || a.start.localeCompare(b.start))
    .map((r) => ({
      [headers.day]: DAY_LABELS_LONG[r.day],
      [headers.start]: r.start,
      [headers.end]: r.end,
      [headers.duration]: fmtDur(durationMin(r.start, r.end)),
      [headers.category]: r.kind,
      [headers.title]: r.title,
      [headers.notes]: r.notes ?? "",
    }));
  const wsRoutine = XLSX.utils.json_to_sheet(routineRows);
  wsRoutine["!cols"] = [{ wch: 12 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 40 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, wsRoutine, sheets.routine);

  // Commitments
  const commitRows = [...data.commitments]
    .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start))
    .map((c) => ({
      Date: c.date,
      [headers.start]: c.start,
      [headers.end]: c.end,
      [headers.duration]: fmtDur(durationMin(c.start, c.end)),
      [headers.category]: c.kind,
      [headers.title]: c.title,
      [headers.notes]: c.notes ?? "",
    }));
  const wsCommit = XLSX.utils.json_to_sheet(commitRows.length ? commitRows : [{ Date: "", [headers.start]: "", [headers.end]: "", [headers.duration]: "", [headers.category]: "", [headers.title]: "", [headers.notes]: "" }]);
  wsCommit["!cols"] = [{ wch: 12 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 40 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, wsCommit, sheets.commitments);

  // Focus blocks (deep work only)
  const focusRows = data.routine
    .filter((r) => r.kind === "deep")
    .map((r) => ({
      [headers.day]: DAY_LABELS_LONG[r.day],
      [headers.start]: r.start,
      [headers.end]: r.end,
      [headers.duration]: fmtDur(durationMin(r.start, r.end)),
      [headers.title]: r.title,
    }));
  const wsFocus = XLSX.utils.json_to_sheet(focusRows.length ? focusRows : [{ [headers.day]: "", [headers.start]: "", [headers.end]: "", [headers.duration]: "", [headers.title]: "" }]);
  wsFocus["!cols"] = [{ wch: 12 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, wsFocus, sheets.focus);

  // Categories / metadata
  const catRows = data.categories.map((c) => ({ [headers.id]: c.id, [headers.label]: c.label, [headers.tone]: c.tone, [headers.description]: c.description }));
  const wsCategories = XLSX.utils.json_to_sheet(catRows);
  wsCategories["!cols"] = [{ wch: 14 }, { wch: 20 }, { wch: 16 }, { wch: 42 }];
  XLSX.utils.book_append_sheet(wb, wsCategories, sheets.categories);

  const metaRows = [
    { [headers.key]: headers.owner, [headers.value]: data.meta.owner },
    { [headers.key]: headers.cycle, [headers.value]: `${data.meta.cycle.name} #${data.meta.cycle.number}` },
    { [headers.key]: headers.week, [headers.value]: data.meta.cycle.week },
    { [headers.key]: headers.workday, [headers.value]: `${data.meta.workdayStart}–${data.meta.workdayEnd}` },
    { [headers.key]: headers.compositionScore, [headers.value]: data.ledger.compositionScore },
    { [headers.key]: headers.exported, [headers.value]: new Date().toISOString() },
  ];
  const wsMeta = XLSX.utils.json_to_sheet(metaRows);
  wsMeta["!cols"] = [{ wch: 22 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, wsMeta, sheets.metadata);

  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  download(new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), filename);
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

export function exportToICS(data: ScheduleData, filename = "chronos-schedule.ics") {
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
  const blob = new Blob([lines.filter(Boolean).join("\r\n")], { type: "text/calendar;charset=utf-8" });
  download(blob, filename);
}

function escapeICS(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export function exportToJSON(data: ScheduleData, filename = "chronos-schedule.json") {
  download(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), filename);
}