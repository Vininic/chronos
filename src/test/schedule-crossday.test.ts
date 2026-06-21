import { describe, expect, it } from "vitest";
import { buildAgendaForDate } from "@/lib/schedule/agenda";
import type { ScheduleData } from "@/lib/schedule/types";

const baseData: ScheduleData = {
  meta: {
    version: 3,
    owner: "Test",
    cycle: { name: "Test", number: 1, week: 1, progress: 0 },
    workdayStart: "07:00",
    workdayEnd: "19:00",
    enforceSleepBoundary: true,
    sleepWindow: { start: "22:30", end: "07:00" },
    sleepSchedule: [{ start: "22:30", end: "07:00", days: [1] }],
  },
  categories: [
    { id: "deep", label: "Deep", tone: "blue", description: "Deep work" },
    { id: "meeting", label: "Meeting", tone: "blue", description: "Meeting" },
    { id: "ritual", label: "Ritual", tone: "blue", description: "Ritual" },
    { id: "recovery", label: "Recovery", tone: "blue", description: "Recovery" },
    { id: "shallow", label: "Shallow", tone: "blue", description: "Shallow" },
    { id: "sleep", label: "Sleep", tone: "blue", description: "Sleep" },
  ],
  routine: [
    { id: "r-cross", day: 0, start: "23:30", end: "01:00", endsNextDay: true, kind: "deep", title: "Crossday" },
  ],
  commitments: [],
  presets: [],
  suggestions: [],
  goals: [],
  progressSnapshots: [],
  ledger: { compositionScore: 0, metrics: [], scheduledHours: [] },
};

describe("crossday schedule boundaries", () => {
  it("does not fall back to the legacy sleepWindow when a weekday has no sleep entry", () => {
    const agenda = buildAgendaForDate(baseData, new Date("2026-05-26T12:00:00"));

    expect(agenda.some((item) => item.kind === "sleep")).toBe(false);
  });

  it("keeps previous-day crossday blocks visible from midnight", () => {
    const agenda = buildAgendaForDate(
      { ...baseData, meta: { ...baseData.meta, enforceSleepBoundary: false } },
      new Date("2026-05-25T12:00:00"),
    );

    expect(agenda).toContainEqual(expect.objectContaining({
      id: "r-cross",
      start: "00:00",
      end: "01:00",
      continuesFromPrevDay: true,
    }));
  });
});
