import ExcelJS from "exceljs";
import type { Category, Commitment, RoutineBlock, ScheduleData } from "./types";
import { createEmptySchedule } from "./templates";
import { withDerived } from "./services/ScheduleService";
import { CHRONOS_XLSX_FORMAT } from "./export";
import { createProviderFromSettings, getProviderRegistration, resolveFallbackProvider } from "@/lib/ai/core/registry";
import { loadSettingsSync, getApiKeyForProvider } from "@/lib/ai/settings/store";

/* ────────────────────────────────────────────────────────────────────────────
 * Cell coercion helpers — exceljs cell values may be strings, numbers, dates,
 * rich-text objects, or hyperlink/formula objects.
 * ──────────────────────────────────────────────────────────────────────────── */
type CellVal = ExcelJS.CellValue;

function cellStr(v: CellVal): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") {
    const o = v as { text?: string; result?: unknown; richText?: { text: string }[] };
    if (o.richText) return o.richText.map((r) => r.text).join("").trim();
    if (typeof o.text === "string") return o.text.trim();
    if (o.result != null) return String(o.result).trim();
  }
  return String(v).trim();
}

/** Coerce a cell that should hold a HH:mm clock value. Handles Excel time
 *  fractions and Date values in case a user re-saved the sheet in Excel. */
function cellTime(v: CellVal): string {
  if (v instanceof Date) {
    return `${String(v.getHours()).padStart(2, "0")}:${String(v.getMinutes()).padStart(2, "0")}`;
  }
  if (typeof v === "number" && v >= 0 && v < 1) {
    const mins = Math.round(v * 24 * 60);
    return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
  }
  const s = cellStr(v);
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : s;
}

let idSeq = 0;
const nextId = (prefix: string) => `${prefix}-imp-${Date.now().toString(36)}-${idSeq++}`;

/* ────────────────────────────────────────────────────────────────────────────
 * 1. Deterministic round-trip: parse a workbook produced by Chronos itself.
 * Returns null when the file is not a recognised Chronos export.
 * ──────────────────────────────────────────────────────────────────────────── */
export async function parseChronosWorkbook(buffer: ArrayBuffer): Promise<ScheduleData | null> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  // Detect our format marker anywhere in the workbook.
  let isChronos = false;
  wb.eachSheet((ws) => {
    ws.eachRow((row) => {
      row.eachCell((cell) => { if (cellStr(cell.value) === CHRONOS_XLSX_FORMAT) isChronos = true; });
    });
  });
  if (!isChronos) return null;

  // Sheets are written in a fixed order; read the machine-readable ones by name
  // (any locale) falling back to position so re-imports survive translation.
  const byName = (...candidates: string[]) =>
    wb.worksheets.find((w) => candidates.some((c) => w.name.toLowerCase() === c.toLowerCase()));

  const routineWs = byName("Routine", "Rotina") ?? wb.worksheets[4];
  const commitWs = byName("Commitments", "Compromissos") ?? wb.worksheets[5];
  const catWs = byName("Categories", "Categorias") ?? wb.worksheets[6];

  const categories: Category[] = [];
  if (catWs) {
    catWs.eachRow((row, n) => {
      if (n === 1) return; // header
      const id = cellStr(row.getCell(1).value);
      if (!id) return;
      categories.push({
        id,
        label: cellStr(row.getCell(2).value) || id,
        tone: cellStr(row.getCell(3).value) || "neutral",
        color: cellStr(row.getCell(4).value) || undefined,
        description: cellStr(row.getCell(5).value) || undefined,
      } as Category);
    });
  }

  const routine: RoutineBlock[] = [];
  if (routineWs) {
    routineWs.eachRow((row, n) => {
      if (n === 1) return;
      const dayNum = Number(cellStr(row.getCell(1).value));
      const start = cellTime(row.getCell(3).value);
      const end = cellTime(row.getCell(4).value);
      const kind = cellStr(row.getCell(6).value);
      const title = cellStr(row.getCell(7).value);
      if (!Number.isFinite(dayNum) || !start || !end || !title) return;
      routine.push({
        id: nextId("r"), day: ((dayNum % 7) + 7) % 7, start, end,
        kind: kind || "shallow", title,
        notes: cellStr(row.getCell(8).value) || undefined,
      } as RoutineBlock);
    });
  }

  const commitments: Commitment[] = [];
  if (commitWs) {
    commitWs.eachRow((row, n) => {
      if (n === 1) return;
      const date = cellStr(row.getCell(1).value);
      const start = cellTime(row.getCell(2).value);
      const end = cellTime(row.getCell(3).value);
      const kind = cellStr(row.getCell(5).value);
      const title = cellStr(row.getCell(6).value);
      if (!date || !start || !end || !title) return;
      commitments.push({
        id: nextId("c"), date, start, end, kind: kind || "shallow", title,
        notes: cellStr(row.getCell(7).value) || undefined,
      } as Commitment);
    });
  }

  const base = createEmptySchedule();
  return withDerived({ ...base, categories, routine, commitments });
}

/* ────────────────────────────────────────────────────────────────────────────
 * 2. AI-assisted import for arbitrary tables (xlsx/csv/text the AI must read).
 * ──────────────────────────────────────────────────────────────────────────── */
export async function workbookToText(buffer: ArrayBuffer): Promise<string> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const parts: string[] = [];
  wb.eachSheet((ws) => {
    parts.push(`### ${ws.name}`);
    ws.eachRow((row) => {
      const cells: string[] = [];
      row.eachCell({ includeEmpty: false }, (cell) => cells.push(cellStr(cell.value)));
      if (cells.length) parts.push(cells.join(" | "));
    });
  });
  return parts.join("\n").slice(0, 12000);
}

function resolveProvider() {
  const settings = loadSettingsSync();
  const providerId = settings.providerId;
  const reg = getProviderRegistration(providerId);
  const apiKey = settings.apiKeys[providerId] || getApiKeyForProvider(providerId);
  if ((reg && !reg.requiresApiKey) || apiKey) {
    return createProviderFromSettings({
      providerId, apiKey: apiKey || "",
      model: settings.models[providerId], baseUrl: settings.baseUrls[providerId],
    });
  }
  const fallback = resolveFallbackProvider(providerId, settings.apiKeys);
  return fallback?.provider ?? null;
}

function extractJsonObject(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  return body.slice(start, end + 1);
}

const IMPORT_SYSTEM_PROMPT = `You convert an arbitrary schedule/timetable (pasted from a spreadsheet or CSV) into Chronos JSON.
Respond with ONLY a JSON object, no prose, shaped exactly:
{
  "categories": [ { "id": "deep", "label": "Deep work", "tone": "bronze", "description": "" } ],
  "routine": [ { "day": 1, "start": "09:00", "end": "10:30", "kind": "deep", "title": "..." } ]
}
Rules:
- day is 0=Sunday … 6=Saturday. Map weekday names accordingly.
- start/end are 24h "HH:mm".
- kind must match a category id you define in "categories".
- tone is one of: bronze, midnight, primary-glow, neutral, sky, violet, coral, mint, peach, amber, slate, lime, rose, emerald, indigo.
- Infer reasonable categories from the activity names. Keep ids short and lowercase.
- Omit anything you cannot map. Output valid JSON only.`;

interface AiParsed {
  categories?: { id: string; label?: string; tone?: string; description?: string }[];
  routine?: { day: number; start: string; end: string; kind: string; title: string }[];
}

export async function aiImportToSchedule(rawText: string): Promise<ScheduleData> {
  const provider = resolveProvider();
  if (!provider) throw new Error("no-provider");

  const result = await provider.generateContent(
    `Convert this into Chronos JSON:\n\n${rawText}`,
    { systemPrompt: IMPORT_SYSTEM_PROMPT, temperature: 0.2, maxTokens: 4096 },
  );
  const json = extractJsonObject(result.text);
  if (!json) throw new Error("no-json");

  let parsed: AiParsed;
  try { parsed = JSON.parse(json) as AiParsed; } catch { throw new Error("bad-json"); }
  if (!Array.isArray(parsed.routine) || parsed.routine.length === 0) throw new Error("empty");

  const categories: Category[] = (parsed.categories ?? []).map((c) => ({
    id: c.id, label: c.label || c.id, tone: c.tone || "neutral", description: c.description || undefined,
  } as Category));
  const knownIds = new Set(categories.map((c) => c.id));

  const routine: RoutineBlock[] = [];
  for (const r of parsed.routine) {
    const day = Number(r.day);
    if (!Number.isFinite(day) || !/^\d{1,2}:\d{2}$/.test(r.start) || !/^\d{1,2}:\d{2}$/.test(r.end) || !r.title) continue;
    const kind = r.kind && knownIds.has(r.kind) ? r.kind : (categories[0]?.id ?? "shallow");
    routine.push({
      id: nextId("r"), day: ((day % 7) + 7) % 7,
      start: r.start.padStart(5, "0"), end: r.end.padStart(5, "0"),
      kind, title: String(r.title),
    } as RoutineBlock);
  }
  if (routine.length === 0) throw new Error("empty");

  const base = createEmptySchedule();
  return withDerived({ ...base, categories, routine });
}
