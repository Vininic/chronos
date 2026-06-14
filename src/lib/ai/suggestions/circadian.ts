import type { ScheduleContext, AiBlock } from "../context/ScheduleContext";
import { parseMin } from "../utils/time";

export interface CircadianInsight {
  type: "peak_focus" | "peak_recovery" | "consistency" | "energy_aware";
  detail: string;
  suggestion?: string;
}

export function analyzeProductivityPatterns(ctx: ScheduleContext): CircadianInsight[] {
  const insights: CircadianInsight[] = [];

  const morningBlocks = ctx.blocks.filter((b) => parseMin(b.start) < 12 * 60);
  const afternoonBlocks = ctx.blocks.filter((b) => {
    const s = parseMin(b.start);
    return s >= 12 * 60 && s < 18 * 60;
  });
  const eveningBlocks = ctx.blocks.filter((b) => parseMin(b.start) >= 18 * 60);

  const morningDeep = morningBlocks.filter((b) => b.category === "deep").length;
  const afternoonDeep = afternoonBlocks.filter((b) => b.category === "deep").length;

  if (morningDeep > afternoonDeep) {
    insights.push({
      type: "peak_focus",
      detail: `More deep work in the morning (${morningDeep} blocks) than afternoon (${afternoonDeep} blocks)`,
      suggestion: "Schedule your most demanding cognitive work before noon",
    });
  } else if (afternoonDeep > morningDeep) {
    insights.push({
      type: "peak_focus",
      detail: `More deep work in the afternoon (${afternoonDeep} blocks) than morning (${morningDeep} blocks)`,
      suggestion: "You may be a afternoon-peak performer — protect this time",
    });
  }

  const morningRecovery = morningBlocks.filter((b) => b.category === "recovery").length;
  const afternoonRecovery = afternoonBlocks.filter((b) => b.category === "recovery").length;

  if (morningRecovery === 0 && afternoonRecovery === 0) {
    insights.push({
      type: "peak_recovery",
      detail: "No recovery blocks found anywhere in the day",
      suggestion: "Add short recovery breaks between focus sessions to maintain energy",
    });
  }

  insights.push(...analyzeCircadianConsistency(ctx));

  return insights;
}

function analyzeCircadianConsistency(ctx: ScheduleContext): CircadianInsight[] {
  const insights: CircadianInsight[] = [];
  const timeSlots = ctx.blocks.map((b) => parseMin(b.start));
  if (timeSlots.length < 2) return [];

  const variance = calculateVariance(timeSlots);
  if (variance > 200) {
    insights.push({
      type: "consistency",
      detail: "High schedule start time variance — blocks begin at very different times",
      suggestion: "Try to anchor your first block to a consistent time each day",
    });
  }

  const categoryTimes = new Map<string, number[]>();
  for (const b of ctx.blocks) {
    const times = categoryTimes.get(b.category) ?? [];
    times.push(parseMin(b.start));
    categoryTimes.set(b.category, times);
  }

  for (const [cat, times] of categoryTimes) {
    if (times.length >= 3) {
      const catVariance = calculateVariance(times);
      if (catVariance > 150) {
        insights.push({
          type: "energy_aware",
          detail: `"${cat}" blocks occur at inconsistent times (variance: ${Math.round(catVariance)}min)`,
          suggestion: `Schedule "${cat}" blocks at the same time daily for better habit formation`,
        });
      }
    }
  }

  return insights;
}

function calculateVariance(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const squaredDiffs = values.map((v) => (v - mean) ** 2);
  return Math.sqrt(squaredDiffs.reduce((s, v) => s + v, 0) / values.length);
}

export function identifyPeakTimes(ctx: ScheduleContext): {
  focusPeak: string;
  recoveryPeak: string;
} {
  const hours = Array.from({ length: 24 }, () => ({ focus: 0, recovery: 0, total: 0 }));

  for (const b of ctx.blocks) {
    const startH = Math.floor(parseMin(b.start) / 60);
    const endH = Math.ceil(parseMin(b.end) / 60);
    for (let h = startH; h < endH && h < 24; h++) {
      if (b.category === "deep" || b.category === "focus") hours[h].focus++;
      else if (b.category === "recovery") hours[h].recovery++;
      hours[h].total++;
    }
  }

  const focusPeakH = hours.reduce((best, h, i) => (h.focus > hours[best].focus ? i : best), 0);
  const recoveryPeakH = hours.reduce((best, h, i) => (h.recovery > hours[best].recovery ? i : best), 0);

  return {
    focusPeak: `${String(focusPeakH).padStart(2, "0")}:00`,
    recoveryPeak: `${String(recoveryPeakH).padStart(2, "0")}:00`,
  };
}


