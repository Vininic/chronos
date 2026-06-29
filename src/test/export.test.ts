import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { buildICS, buildStyledWorkbook, serializeScheduleJSON, CHRONOS_XLSX_FORMAT } from "@/lib/schedule/export";
import { parseChronosWorkbook } from "@/lib/schedule/import";
import type { ScheduleData } from "@/lib/schedule/types";

const DATA = {
  meta: {
    version: 3,
    owner: "Test Owner",
    cycle: { name: "Cycle One", number: 1, week: 2 },
    workdayStart: "09:00",
    workdayEnd: "18:00",
  },
  categories: [
    { id: "deep", label: "Deep Work", tone: "custom", description: "Focus" },
    { id: "recovery", label: "Recovery", tone: "custom", description: "Rest" },
  ],
  routine: [
    { id: "r1", day: 1, kind: "deep", title: "Deep, Work", start: "10:00", end: "12:00" },
    { id: "r2", day: 2, kind: "recovery", title: "Walk", start: "12:00", end: "13:00" },
  ],
  commitments: [
    { id: "c1", date: "2026-06-24", kind: "meeting", title: "Standup", start: "14:00", end: "14:30", notes: "weekly; sync" },
  ],
  ledger: { compositionScore: 0.5, metrics: [], scheduledHours: [] },
} as unknown as ScheduleData;

describe("buildICS", () => {
  const ics = buildICS(DATA);

  it("wraps a valid VCALENDAR envelope", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR")).toBe(true);
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
  });

  it("emits one VEVENT per routine block and commitment", () => {
    const count = (ics.match(/BEGIN:VEVENT/g) ?? []).length;
    expect(count).toBe(DATA.routine.length + DATA.commitments.length);
  });

  it("adds a weekly RRULE for routine blocks only", () => {
    expect(ics).toContain("RRULE:FREQ=WEEKLY;BYDAY=MO");
  });

  it("escapes commas and semicolons per RFC 5545", () => {
    expect(ics).toContain("SUMMARY:Deep\\, Work");
    expect(ics).toContain("DESCRIPTION:weekly\\; sync");
  });
});

describe("buildStyledWorkbook", () => {
  it("includes a visual Day Planner plus legend and machine-readable sheets", () => {
    const wb = buildStyledWorkbook(DATA, "en");
    const names = wb.worksheets.map((w) => w.name);
    expect(names).toContain("Day Planner");
    expect(names).toContain("Block Types");
    expect(names).toContain("Goals");
    expect(names).toContain("Workplans");
    expect(names).toContain("Routine");
    expect(names).toContain("Commitments");
    expect(names).toContain("Categories");
    expect(names).toContain("Metadata");
  });

  it("writes one Routine data row per block (plus a header row)", () => {
    const wb = buildStyledWorkbook(DATA, "en");
    const routine = wb.getWorksheet("Routine")!;
    expect(routine.rowCount).toBe(1 + DATA.routine.length);
  });

  it("paints the Day Planner block cells with a solid fill", () => {
    const wb = buildStyledWorkbook(DATA, "en");
    const planner = wb.getWorksheet("Day Planner")!;
    // r1 is a Monday (day 1 → column 3) block; some painted cell must have a fill.
    let painted = false;
    planner.eachRow((row) => {
      const cell = row.getCell(3);
      if (cell.fill && (cell.fill as { pattern?: string }).pattern === "solid") painted = true;
    });
    expect(painted).toBe(true);
  });

  it("stamps the round-trip format marker into the Metadata sheet", () => {
    const wb = buildStyledWorkbook(DATA, "en");
    const meta = wb.getWorksheet("Metadata")!;
    const values: string[] = [];
    meta.eachRow((row) => values.push(String(row.getCell(2).value)));
    expect(values).toContain(CHRONOS_XLSX_FORMAT);
  });
});

describe("XLSX round-trip (parseChronosWorkbook)", () => {
  it("re-imports routine, commitments and categories from its own export", async () => {
    const wb = buildStyledWorkbook(DATA, "en");
    const buf = await wb.xlsx.writeBuffer();
    const back = await parseChronosWorkbook(buf as ArrayBuffer);
    expect(back).not.toBeNull();
    expect(back!.routine).toHaveLength(DATA.routine.length);
    expect(back!.routine.map((r) => r.title)).toContain("Deep, Work");
    expect(back!.routine.find((r) => r.title === "Deep, Work")?.start).toBe("10:00");
    expect(back!.commitments).toHaveLength(DATA.commitments.length);
    expect(back!.categories.map((c) => c.id)).toEqual(expect.arrayContaining(["deep", "recovery"]));
  });

  it("round-trips through the Portuguese (translated sheet names) export", async () => {
    const wb = buildStyledWorkbook(DATA, "pt");
    const buf = await wb.xlsx.writeBuffer();
    const back = await parseChronosWorkbook(buf as ArrayBuffer);
    expect(back).not.toBeNull();
    expect(back!.routine).toHaveLength(DATA.routine.length);
  });

  it("returns null for a workbook without the Chronos marker", async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet("Sheet1").addRow(["foo", "bar"]);
    const buf = await wb.xlsx.writeBuffer();
    expect(await parseChronosWorkbook(buf as ArrayBuffer)).toBeNull();
  });
});

describe("serializeScheduleJSON", () => {
  it("round-trips the schedule and pretty-prints it", () => {
    const json = serializeScheduleJSON(DATA);
    expect(json).toContain("\n");
    expect(JSON.parse(json)).toEqual(DATA);
  });
});
