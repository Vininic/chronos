import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { buildICS, buildScheduleWorkbook, serializeScheduleJSON } from "@/lib/schedule/export";
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

describe("buildScheduleWorkbook", () => {
  it("creates the five expected sheets", () => {
    const wb = buildScheduleWorkbook(DATA, "en");
    expect(wb.SheetNames).toHaveLength(5);
  });

  it("writes one routine row per block and only deep-work blocks to the focus sheet", () => {
    const wb = buildScheduleWorkbook(DATA, "en");
    const routineRows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
    expect(routineRows).toHaveLength(2);
    const focusRows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[2]]);
    expect(focusRows).toHaveLength(1); // only the "deep" block
  });
});

describe("serializeScheduleJSON", () => {
  it("round-trips the schedule and pretty-prints it", () => {
    const json = serializeScheduleJSON(DATA);
    expect(json).toContain("\n");
    expect(JSON.parse(json)).toEqual(DATA);
  });
});
