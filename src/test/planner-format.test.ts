import { describe, expect, it } from "vitest";
import {
  addDays, toIsoDate, isSameDay, fmtFriendlyDuration,
  topFor, blockHeight, freeHeight, buildTimeline, isBoundarySleepBlock, HOUR_PX,
} from "@/lib/schedule/planner-format";
import type { AgendaItem } from "@/lib/schedule/agenda";

describe("addDays", () => {
  it("adds positive days", () => {
    const d = new Date("2026-06-25T12:00:00");
    const r = addDays(d, 3);
    expect(r.toISOString().slice(0, 10)).toBe("2026-06-28");
  });

  it("adds negative days", () => {
    const d = new Date("2026-06-25T12:00:00");
    const r = addDays(d, -5);
    expect(r.toISOString().slice(0, 10)).toBe("2026-06-20");
  });
});

describe("toIsoDate", () => {
  it("formats date as YYYY-MM-DD", () => {
    expect(toIsoDate(new Date("2026-06-01T12:00:00"))).toBe("2026-06-01");
  });

  it("pads month and day", () => {
    expect(toIsoDate(new Date("2026-01-05T12:00:00"))).toBe("2026-01-05");
  });
});

describe("isSameDay", () => {
  it("returns true for same day", () => {
    expect(isSameDay(new Date("2026-06-25T08:00:00"), new Date("2026-06-25T20:00:00"))).toBe(true);
  });

  it("returns false for different days", () => {
    expect(isSameDay(new Date("2026-06-25T12:00:00"), new Date("2026-06-26T12:00:00"))).toBe(false);
  });
});

describe("fmtFriendlyDuration", () => {
  it("formats hours only", () => {
    expect(fmtFriendlyDuration(120, false)).toBe("2h");
  });

  it("formats minutes only", () => {
    expect(fmtFriendlyDuration(45, false)).toBe("45m");
  });

  it("formats hours and minutes in English", () => {
    expect(fmtFriendlyDuration(90, false)).toBe("1h 30m");
  });

  it("formats hours and minutes in Portuguese", () => {
    expect(fmtFriendlyDuration(90, true)).toBe("1h 30min");
  });

  it("handles zero", () => {
    expect(fmtFriendlyDuration(0, false)).toBe("0m");
  });
});

describe("topFor", () => {
  it("returns 0 for startMin == time", () => {
    expect(topFor("07:00", 420)).toBe(0);
  });

  it("returns HOUR_PX for one hour later", () => {
    expect(topFor("08:00", 420)).toBe(HOUR_PX);
  });

  it("returns 2 * HOUR_PX for two hours later", () => {
    expect(topFor("09:00", 420)).toBe(2 * HOUR_PX);
  });
});

describe("blockHeight", () => {
  it("returns height for a 1-hour block", () => {
    expect(blockHeight("07:00", "08:00")).toBe(HOUR_PX - 4);
  });

  it("returns height for a 30-min block", () => {
    expect(blockHeight("07:00", "07:30")).toBe(28);
  });

  it("clamps to minimum 20px", () => {
    expect(blockHeight("07:00", "07:05")).toBe(20);
  });
});

describe("freeHeight", () => {
  it("returns height for a 1-hour free slot", () => {
    expect(freeHeight("10:00", "11:00")).toBe(HOUR_PX - 2);
  });

  it("clamps to minimum 8px", () => {
    expect(freeHeight("10:00", "10:05")).toBe(8);
  });
});

describe("isBoundarySleepBlock", () => {
  it("returns false for non-sleep block", () => {
    const a = { kind: "deep" } as AgendaItem;
    expect(isBoundarySleepBlock(a)).toBe(false);
  });

  it("returns true for boundary sleep block", () => {
    const a = { kind: "sleep", sleepBoundary: true } as AgendaItem & { sleepBoundary?: boolean };
    expect(isBoundarySleepBlock(a)).toBe(true);
  });

  it("returns false for non-boundary sleep block", () => {
    const a = { kind: "sleep" } as AgendaItem;
    expect(isBoundarySleepBlock(a)).toBe(false);
  });
});

describe("buildTimeline", () => {
  it("returns a free slot for an empty agenda", () => {
    const result = buildTimeline([], 0, 1440);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ type: "free", start: "00:00", end: "24:00" });
  });

  it("inserts free slots between blocks", () => {
    const agenda = [
      { id: "a", start: "07:00", end: "08:00", kind: "deep", title: "A", source: "routine" },
      { id: "b", start: "10:00", end: "11:00", kind: "deep", title: "B", source: "routine" },
    ] as AgendaItem[];
    const result = buildTimeline(agenda, 0, 1440);
    const freeSlots = result.filter((r) => "type" in r && r.type === "free");
    expect(freeSlots.length).toBeGreaterThanOrEqual(2);
  });

  it("clips blocks to a narrow day window", () => {
    const agenda = [
      { id: "a", start: "07:00", end: "19:00", kind: "deep", title: "Long", source: "routine" },
    ] as AgendaItem[];
    const result = buildTimeline(agenda, 420, 600); // 07:00–10:00
    const block = result.find((r) => !("type" in r) || r.type !== "free") as AgendaItem;
    expect(block).toBeDefined();
    expect(block.start).toBe("07:00");
    expect(block.end).toBe("10:00");
  });

  it("skips blocks entirely outside the day range", () => {
    const agenda = [
      { id: "a", start: "05:00", end: "06:00", kind: "deep", title: "Early", source: "routine" },
    ] as AgendaItem[];
    const result = buildTimeline(agenda, 420, 1140); // 07:00–19:00
    expect(result.every((r) => !("id" in r && r.id === "a"))).toBe(true);
  });
});
