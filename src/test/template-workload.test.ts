import { describe, it, expect } from "vitest";
import { SCHEDULE_TEMPLATES, weeklyRoutineHours, classifyWorkload } from "@/lib/schedule/templates";

describe("template workload is honest (derived from real density)", () => {
  it("every template's workload tag matches its actual weekly block density", () => {
    for (const t of SCHEDULE_TEMPLATES) {
      const hours = weeklyRoutineHours(t.generate());
      expect(t.workload, `${t.id} @ ${hours.toFixed(1)}h`).toBe(classifyWorkload(hours));
    }
  });

  it("produces a spread across all three tiers (not 8/5/1 intense-heavy)", () => {
    const counts = { light: 0, moderate: 0, intense: 0 };
    for (const t of SCHEDULE_TEMPLATES) counts[t.workload]++;
    expect(counts.light).toBeGreaterThanOrEqual(2);
    expect(counts.moderate).toBeGreaterThanOrEqual(2);
    expect(counts.intense).toBeGreaterThanOrEqual(2);
  });
});

describe("classifyWorkload thresholds", () => {
  it("maps density to tiers", () => {
    expect(classifyWorkload(30)).toBe("light");
    expect(classifyWorkload(50)).toBe("moderate");
    expect(classifyWorkload(70)).toBe("intense");
  });
});
