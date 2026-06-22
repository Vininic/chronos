import type { ScheduleData } from "@/lib/schedule/types";
import type { Digest, DigestTimeframe, DigestColor, ReportCard, ReportCardKind, ReportCardSeverity } from "./types";
import type { Insight } from "@/lib/ai/core/schemas";
import { addDigest } from "./store";
import { loadSettingsSync } from "@/lib/ai/settings/store";
import { buildContext } from "@/lib/ai/context/buildContext";
import { callGemini } from "@/lib/ai/core/gemini";
import { resolveProvider } from "@/lib/ai/core/resolveProvider";

import { optimizeSchedule } from "@/lib/ai/optimization/optimizationEngine";
import { filterHallucinatedConflicts } from "@/lib/ai/core/validateConflictClaims";
import { buildDigestContext, type DigestContext } from "./modules/helpers";
import { recoveryAnalysis } from "./modules/recovery";
import { productivityAnalysis } from "./modules/productivity";
import { scheduleQualityAnalysis } from "./modules/schedule-quality";
import { goalAlignmentAnalysis } from "./modules/goal-alignment";
import { consistencyAnalysis } from "./modules/consistency";
import { programsAnalysis } from "./modules/programs";
import { burnoutAnalysis } from "./modules/burnout";
import { opportunityAnalysis } from "./modules/opportunity";

type DigestModule = (data: ScheduleData, ctx: DigestContext) => ReportCard[];

const HEURISTIC_MODULES: DigestModule[] = [
  recoveryAnalysis,
  productivityAnalysis,
  scheduleQualityAnalysis,
  goalAlignmentAnalysis,
  consistencyAnalysis,
  programsAnalysis,
  burnoutAnalysis,
  opportunityAnalysis,
];

const MAX_CARDS = 12;

const INSIGHT_TYPE_TO_KIND: Record<string, ReportCardKind> = {
  overload: "recovery",
  burnout_risk: "burnout",
  sleep_debt: "recovery",
  context_switching: "schedule-quality",
  consecutive_work: "burnout",
  goal_neglected: "goal-alignment",
  goal_conflict: "goal-alignment",
  weekly_imbalance: "productivity",
  optimization: "opportunity",
  recommendation: "opportunity",
};

const SEVERITY_MAP: Record<string, ReportCardSeverity> = {
  info: "insight",
  warning: "warning",
  critical: "warning",
};

const CARD_ORDER: Record<string, number> = {
  burnout: 1,
  recovery: 2,
  productivity: 3,
  "schedule-quality": 4,
  consistency: 5,
  programs: 6,
  "goal-alignment": 7,
  opportunity: 8,
};

const TIMEFRAME_COLORS: Record<DigestTimeframe, DigestColor> = {
  daily: "blue",
  weekly: "purple",
  monthly: "amber",
  custom: "teal",
};

function generateId(): string {
  return `digest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildSummary(cards: ReportCard[]): string {
  if (cards.length === 0) return "No significant findings for this period.";
  const topCard = cards[0];
  const count = cards.length;
  return `${topCard.title}. ${topCard.body.slice(0, 120)}${topCard.body.length > 120 ? "..." : ""} (${count} observation${count > 1 ? "s" : ""})`;
}

function buildRecommendations(cards: ReportCard[]): string[] {
  return cards
    .filter((c) => c.actionable && c.detail)
    .slice(0, 3)
    .map((c) => c.detail!);
}

function buildOpportunities(cards: ReportCard[]): { label: string; action?: string }[] {
  return cards
    .filter((c) => c.actionable && c.severity === "opportunity")
    .slice(0, 3)
    .map((c) => ({ label: c.title, action: c.title.toLowerCase().replace(/\s+/g, "-") }));
}

function insightToReportCard(insight: Insight): ReportCard {
  const kind = INSIGHT_TYPE_TO_KIND[insight.type] ?? "opportunity";
  const severity = SEVERITY_MAP[insight.severity] ?? "insight";
  return {
    kind,
    severity,
    title: insight.title,
    body: insight.detail,
    detail: insight.suggestion,
    actionable: !!insight.suggestion && insight.severity !== "info",
  };
}

const TIMEFRAME_SCOPE: Record<string, string> = {
  daily: "This is a DAILY digest. Focus on today's block completion, immediate energy management, and same-day recovery needs. Highlight acute issues only.",
  weekly: "This is a WEEKLY review. Focus on 7-day patterns, consistency across days, weekly focus/recovery balance, and habit trends. Avoid day-level micro-issues.",
  monthly: "This is a MONTHLY review. Focus on long-term trajectory, habit formation progress, burnout risk accumulation, and strategic category balance. Think in trends, not events.",
  custom: "This is a CUSTOM RANGE digest. Analyze the overall pattern across the specified date range, noting recurring issues and systemic imbalances.",
};

async function aiCards(data: ScheduleData, tf: string): Promise<ReportCard[] | null> {
  try {
    const settings = loadSettingsSync();
    const autonomy = settings.autonomy ?? "balanced";
    const ctx = buildContext(data, autonomy);
    const provider = resolveProvider();
    const scope = TIMEFRAME_SCOPE[tf] ?? TIMEFRAME_SCOPE.daily;
    const result = await callGemini(ctx, autonomy, provider ?? undefined, scope);
    const insights = result.response.insights;
    if (!insights || insights.length === 0) return null;
    return insights.map(insightToReportCard);
  } catch {
    return null;
  }
}

function heuristicCards(ctx: DigestContext, data: ScheduleData): ReportCard[] {
  const allCards: ReportCard[] = [];
  for (const module of HEURISTIC_MODULES) {
    try {
      allCards.push(...module(data, ctx));
    } catch {
      // A single misbehaving module shouldn't sink the whole digest.
    }
  }
  // Warnings first within each kind, then by kind order; cap to keep signal high.
  const sevRank = (s: ReportCard["severity"]) => (s === "warning" ? 0 : 1);
  allCards.sort((a, b) => {
    const k = (CARD_ORDER[a.kind] ?? 99) - (CARD_ORDER[b.kind] ?? 99);
    return k !== 0 ? k : sevRank(a.severity) - sevRank(b.severity);
  });
  return allCards.slice(0, MAX_CARDS);
}

export async function generateDigest(
  data: ScheduleData,
  timeframe?: DigestTimeframe,
  customDate?: { start: string; end: string },
): Promise<Digest> {
  const settings = loadSettingsSync();
  const mode: "auto" | "manual" = settings.featureToggles.digestAuto ? "auto" : "manual";
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const tf = timeframe ?? "daily";
  const color = TIMEFRAME_COLORS[tf];

  const date = tf === "custom" && customDate
    ? customDate.start + " -- " + customDate.end
    : tf === "weekly"
    ? (() => { const d = new Date(now); d.setDate(d.getDate() - d.getDay()); return d.toISOString().slice(0, 10); })()
    : tf === "monthly"
    ? today.slice(0, 7) + "-01"
    : today;

  let allCards: ReportCard[];
  let generatedBy: "ai" | "heuristic" = "heuristic";

  // Deterministic per-timeframe view of the schedule (routine + commitments
  // expanded across the actual date range). Shared by every heuristic module.
  const digestCtx = buildDigestContext(data, tf, customDate);

  // Pre-compute deterministic structural state so AI cards can be validated.
  // The AI sees all routine blocks aggregated across days and sometimes mistakes
  // same-time blocks on different weekdays as same-time conflicts.
  const realConflicts = optimizeSchedule(buildContext(data, "balanced")).conflicts.length;

  const ai = await aiCards(data, tf);
  if (ai && ai.length > 0) {
    // Suppress AI cards claiming time overlaps when the deterministic, day-aware
    // checker found none — a cross-day hallucination. Shared with the pipeline.
    const validated = filterHallucinatedConflicts(ai, realConflicts, (card) => `${card.title} ${card.body}`);
    allCards = validated.length > 0 ? validated : heuristicCards(digestCtx, data);
    generatedBy = validated.length > 0 ? "ai" : "heuristic";
  } else {
    allCards = heuristicCards(digestCtx, data);
  }

  const digest: Digest = {
    id: generateId(),
    mode,
    timeframe: tf,
    date,
    generatedAt: new Date().toISOString(),
    color,
    generatedBy,
    summary: buildSummary(allCards),
    cards: allCards,
    recommendations: buildRecommendations(allCards),
    opportunities: buildOpportunities(allCards),
  };

  addDigest(digest);
  return digest;
}
