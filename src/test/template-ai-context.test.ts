import { describe, it, expect } from "vitest";
import { SCHEDULE_TEMPLATES } from "@/lib/schedule/templates";
import { buildContext } from "@/lib/ai/context";
import { compressContext } from "@/lib/ai/context/serializers";
import { optimizeSchedule } from "@/lib/ai/optimization/optimizationEngine";
import { filterHallucinatedConflicts, claimsTimeOverlap } from "@/lib/ai/core/validateConflictClaims";
import { durationMin } from "@/lib/schedule/types";

// Regression coverage for the two template "false AI concerns" bugs:
//  A) phantom ~8h sleep debt — buildContext used to ignore meta.sleepWindow
//  B) cross-day overlap hallucination — blocks were serialized without weekday

describe("templates → AI context: no false concerns", () => {
  for (const tmpl of SCHEDULE_TEMPLATES) {
    describe(tmpl.name, () => {
      const data = tmpl.generate();
      const ctx = buildContext(data);

      it("reports sleep debt from the template's real sleep window, not a phantom 8h", () => {
        const win = data.meta.sleepWindow!;
        const sleepMin = durationMin(win.start, win.end);
        const expectedDebt = Math.max(0, 8 * 60 - sleepMin);

        expect(ctx.sleep.metrics.debtMin).toBe(expectedDebt);
        // The pre-fix bug collapsed avgSleep to 0 → a full 480min phantom debt.
        expect(ctx.sleep.metrics.debtMin).toBeLessThan(8 * 60);
        expect(ctx.sleep.metrics.averageDurationMin).toBe(sleepMin);
      });

      it("has zero real scheduling conflicts (day-aware)", () => {
        expect(optimizeSchedule(ctx).conflicts.length).toBe(0);
      });

      it("serializes blocks grouped under weekday headers", () => {
        const blocks = compressContext(ctx).blocks;
        // At least one weekday header must be present so the model can tell
        // same-time blocks on different days apart.
        expect(/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat):/m.test(blocks)).toBe(true);
        // Block lines are indented beneath their day header.
        expect(/^ {2}\[[ x>]\] \d{2}:\d{2}-/m.test(blocks)).toBe(true);
      });
    });
  }
});

describe("filterHallucinatedConflicts", () => {
  type Card = { title: string; body: string };
  const text = (c: Card) => `${c.title} ${c.body}`;

  it("drops time-overlap claims when no real conflicts exist", () => {
    const cards: Card[] = [
      { title: "Severe overlap", body: "Two deep blocks at 08:00 overlap." },
      { title: "Healthy focus", body: "Your deep work is well distributed." },
    ];
    const kept = filterHallucinatedConflicts(cards, 0, text);
    expect(kept).toHaveLength(1);
    expect(kept[0].title).toBe("Healthy focus");
  });

  it("keeps everything when the deterministic check found real conflicts", () => {
    const cards: Card[] = [{ title: "Overlap", body: "blocks at the same time" }];
    expect(filterHallucinatedConflicts(cards, 2, text)).toHaveLength(1);
  });

  it("does not suppress non-time 'conflict' wording (e.g. goal conflicts)", () => {
    const cards: Card[] = [
      { title: "Goal conflict", body: "Two goals compete for your attention this week." },
    ];
    expect(filterHallucinatedConflicts(cards, 0, text)).toHaveLength(1);
  });

  it("claimsTimeOverlap matches collision language only", () => {
    expect(claimsTimeOverlap("these blocks overlap")).toBe(true);
    expect(claimsTimeOverlap("scheduled at the same time")).toBe(true);
    expect(claimsTimeOverlap("physically impossible to attend both")).toBe(true);
    expect(claimsTimeOverlap("a goal conflict with your priorities")).toBe(false);
    expect(claimsTimeOverlap("consider more recovery")).toBe(false);
  });
});
