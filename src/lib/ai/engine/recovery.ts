import type { ScheduleContext } from "../context/ScheduleContext";
import { parseMin } from "../utils/time";

export interface RecoverySignal {
  type: "overload" | "burnout_risk" | "sleep_debt" | "context_switching" | "consecutive_work";
  severity: "low" | "medium" | "high";
  detail: string;
  suggestion?: string;
}

export interface RecoveryIntelligenceResult {
  overloadDetected: boolean;
  burnoutDetected: boolean;
  recoveryScore: number;
  sustainableScore: number;
  recommendations: string[];
}

/* ── Detect overload ────────────────────────────────────── */
export function detectOverload(ctx: ScheduleContext): RecoverySignal | null {
  const totalMin = ctx.blocks.reduce((s, b) => s + b.durationMin, 0);
  const workdayMin = parseMin(ctx.workday.end) - parseMin(ctx.workday.start);
  const overloadRatio = totalMin / Math.max(1, workdayMin);

  if (overloadRatio > 1.2) {
    return {
      type: "overload",
      severity: "high",
      detail: `Schedule is ${Math.round((overloadRatio - 1) * 100)}% over workday capacity`,
      suggestion: "Reduce total scheduled time by 30-60 minutes",
    };
  }
  if (overloadRatio > 1) {
    return {
      type: "overload",
      severity: "medium",
      detail: `Schedule slightly exceeds workday capacity (${Math.round(overloadRatio * 100)}%)`,
      suggestion: "Consider trimming lower-priority blocks",
    };
  }
  return null;
}

/* ── Detect burnout risk ─────────────────────────────────── */
export function detectBurnoutRisk(ctx: ScheduleContext): RecoverySignal | null {
  const lowRecovery = ctx.metrics.recoveryTimeMin < 30;
  const highOverload = ctx.metrics.overloadScore > 0.8;
  const lowSleep = ctx.sleep.metrics.averageDurationMin < 360;
  const hasBurnoutNotes = ctx.notes.some(
    (n) => /tired|exhausted|burnout|overwhelmed|cannot|too much/i.test(n.text),
  );

  const signals = [lowRecovery, highOverload, lowSleep, hasBurnoutNotes].filter(Boolean).length;

  if (signals >= 3) {
    return {
      type: "burnout_risk",
      severity: "high",
      detail: "Multiple burnout indicators detected: low recovery, high overload, insufficient sleep",
      suggestion: "Take a recovery day with minimal scheduling",
    };
  }
  if (signals >= 2) {
    return {
      type: "burnout_risk",
      severity: "medium",
      detail: "Early burnout indicators present",
      suggestion: "Increase recovery blocks and monitor energy levels",
    };
  }
  return null;
}

/* ── Detect sleep debt ───────────────────────────────────── */
export function detectSleepDebt(ctx: ScheduleContext): RecoverySignal | null {
  const debtHours = ctx.sleep.metrics.debtMin / 60;

  if (debtHours >= 3) {
    return {
      type: "sleep_debt",
      severity: "high",
      detail: `Sleep debt of ${debtHours.toFixed(1)}h — significant accumulated deficit`,
      suggestion: "Prioritize early bedtime and extend sleep by 1-2 hours",
    };
  }
  if (debtHours >= 1) {
    return {
      type: "sleep_debt",
      severity: "medium",
      detail: `Sleep debt of ${debtHours.toFixed(1)}h`,
      suggestion: "Consider going to bed 30-60 minutes earlier",
    };
  }
  if (ctx.sleep.metrics.consistency < 0.6) {
    return {
      type: "sleep_debt",
      severity: "low",
      detail: "Sleep schedule is inconsistent",
      suggestion: "Try to maintain consistent bed and wake times",
    };
  }
  return null;
}

/* ── Detect excessive context switching ──────────────────── */
export function detectContextSwitching(ctx: ScheduleContext): RecoverySignal | null {
  if (ctx.blocks.length < 3) return null;

  let switches = 0;
  for (let i = 1; i < ctx.blocks.length; i++) {
    if (ctx.blocks[i].category !== ctx.blocks[i - 1].category) switches++;
  }

  const switchRate = switches / ctx.blocks.length;

  if (switchRate > 0.7) {
    return {
      type: "context_switching",
      severity: "high",
      detail: `High context switching: ${switches} changes across ${ctx.blocks.length} blocks`,
      suggestion: "Batch similar activities together to reduce cognitive overhead",
    };
  }
  if (switchRate > 0.4) {
    return {
      type: "context_switching",
      severity: "medium",
      detail: `Moderate context switching: ${switches} changes across ${ctx.blocks.length} blocks`,
      suggestion: "Consider grouping related tasks",
    };
  }
  return null;
}

/* ── Detect excessive consecutive work blocks ────────────── */
export function detectConsecutiveWorkBlocks(ctx: ScheduleContext): RecoverySignal | null {
  const recoveryCategories = new Set(["recovery", "sleep"]);
  let maxConsecutive = 0;
  let currentStreak = 0;

  for (const b of ctx.blocks) {
    if (recoveryCategories.has(b.category)) {
      currentStreak = 0;
    } else {
      currentStreak++;
      maxConsecutive = Math.max(maxConsecutive, currentStreak);
    }
  }

  if (maxConsecutive >= 6) {
    return {
      type: "consecutive_work",
      severity: "high",
      detail: `${maxConsecutive} consecutive work blocks without recovery`,
      suggestion: "Insert a 15-30 minute break after every 3 work blocks",
    };
  }
  if (maxConsecutive >= 4) {
    return {
      type: "consecutive_work",
      severity: "medium",
      detail: `${maxConsecutive} consecutive work blocks without recovery`,
      suggestion: "Consider adding a short break between blocks",
    };
  }
  return null;
}

/* ── Recommend recovery actions ──────────────────────────── */
export function recommendRecoveryAction(ctx: ScheduleContext): RecoverySignal | null {
  const signals = [
    detectOverload(ctx),
    detectBurnoutRisk(ctx),
    detectSleepDebt(ctx),
    detectContextSwitching(ctx),
    detectConsecutiveWorkBlocks(ctx),
  ].filter((s): s is RecoverySignal => s !== null);

  if (signals.length === 0) return null;

  const highest = signals.reduce((a, b) =>
    severityWeight(a.severity) > severityWeight(b.severity) ? a : b,
  );

  return {
    ...highest,
    suggestion: highest.suggestion ?? "Prioritize rest and recovery",
  };
}

/* ── Run all recovery checks ─────────────────────────────── */
export function analyzeRecovery(ctx: ScheduleContext): RecoverySignal[] {
  return [
    detectOverload(ctx),
    detectBurnoutRisk(ctx),
    detectSleepDebt(ctx),
    detectContextSwitching(ctx),
    detectConsecutiveWorkBlocks(ctx),
  ].filter((s): s is RecoverySignal => s !== null);
}

export function calculateRecoveryScore(ctx: ScheduleContext): number {
  let score = 100;
  const recoveryRatio = ctx.metrics.recoveryTimeMin / Math.max(1, ctx.metrics.focusTimeMin);
  if (recoveryRatio < 0.2) score -= 20;
  if (recoveryRatio < 0.1) score -= 20;
  if (ctx.sleep.metrics.averageDurationMin < 420) score -= 15;
  if (ctx.sleep.metrics.averageDurationMin < 360) score -= 15;
  if (ctx.sleep.metrics.debtMin > 120) score -= 15;
  if (ctx.sleep.metrics.debtMin > 240) score -= 10;
  const consecutiveWork = countMaxConsecutiveWork(ctx);
  if (consecutiveWork >= 6) score -= 15;
  if (consecutiveWork >= 4) score -= 10;
  return Math.max(0, Math.min(100, score));
}

export function calculateSustainabilityScore(ctx: ScheduleContext): number {
  const totalMin = ctx.blocks.reduce((s, b) => s + b.durationMin, 0);
  const workdayMin = parseMin(ctx.workday.end) - parseMin(ctx.workday.start);
  const overloadRatio = totalMin / Math.max(1, workdayMin);
  let score = 100;
  if (overloadRatio > 1) score -= (overloadRatio - 1) * 50;
  if (ctx.sleep.metrics.consistency < 0.6) score -= 15;
  if (ctx.metrics.overloadScore > 0.7) score -= 15;
  const variety = new Set(ctx.blocks.map((b) => b.category)).size;
  if (variety <= 2 && ctx.blocks.length > 3) score -= 10;
  return Math.max(0, Math.min(100, score));
}

export function assessRecoveryIntelligence(ctx: ScheduleContext): RecoveryIntelligenceResult {
  const totalMin = ctx.blocks.reduce((s, b) => s + b.durationMin, 0);
  const workdayMin = parseMin(ctx.workday.end) - parseMin(ctx.workday.start);
  const overloadRatio = totalMin / Math.max(1, workdayMin);
  const lowRecovery = ctx.metrics.recoveryTimeMin < 30;
  const highOverload = ctx.metrics.overloadScore > 0.8;
  const lowSleep = ctx.sleep.metrics.averageDurationMin < 360;
  const burnoutNotes = ctx.notes.some((n) => /tired|exhausted|burnout|overwhelmed/i.test(n.text));
  const burnoutSignals = [lowRecovery, highOverload, lowSleep, burnoutNotes].filter(Boolean).length;
  const recommendations: string[] = [];
  if (overloadRatio > 1.2) recommendations.push(`Reduce total scheduled time by ${Math.round((overloadRatio - 1) * 100)}% to match workday capacity`);
  if (burnoutSignals >= 2) recommendations.push("Take a recovery day — multiple burnout indicators detected");
  if (ctx.sleep.metrics.debtMin > 120) recommendations.push("Sleep debt exceeds 2 hours — prioritize earlier bedtimes");
  if (ctx.metrics.recoveryTimeMin < 60) recommendations.push("Increase daily recovery to at least 60 minutes");
  return {
    overloadDetected: overloadRatio > 1,
    burnoutDetected: burnoutSignals >= 2,
    recoveryScore: calculateRecoveryScore(ctx),
    sustainableScore: calculateSustainabilityScore(ctx),
    recommendations,
  };
}

function countMaxConsecutiveWork(ctx: ScheduleContext): number {
  const recoveryCategories = new Set(["recovery", "sleep"]);
  let maxStreak = 0;
  let current = 0;
  for (const b of ctx.blocks) {
    if (recoveryCategories.has(b.category)) {
      current = 0;
    } else {
      current++;
      maxStreak = Math.max(maxStreak, current);
    }
  }
  return maxStreak;
}

function severityWeight(s: "low" | "medium" | "high"): number {
  return s === "high" ? 3 : s === "medium" ? 2 : 1;
}
