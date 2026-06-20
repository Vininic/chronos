import type { ScheduleData } from "@/lib/schedule/types";
import type { Digest, DigestTimeframe, DigestColor, ReportCard, ReportCardKind, ReportCardSeverity } from "./types";
import type { Insight } from "@/lib/ai/core/schemas";
import { addDigest } from "./store";
import { loadSettingsSync } from "@/lib/ai/settings/store";
import { buildContext } from "@/lib/ai/context/buildContext";
import { callGemini } from "@/lib/ai/core/gemini";

import { recoveryAnalysis } from "./modules/recovery";
import { productivityAnalysis } from "./modules/productivity";
import { scheduleQualityAnalysis } from "./modules/schedule-quality";
import { goalAlignmentAnalysis } from "./modules/goal-alignment";
import { consistencyAnalysis } from "./modules/consistency";
import { programsAnalysis } from "./modules/programs";
import { burnoutAnalysis } from "./modules/burnout";
import { opportunityAnalysis } from "./modules/opportunity";

const HEURISTIC_MODULES = [
  recoveryAnalysis,
  productivityAnalysis,
  scheduleQualityAnalysis,
  goalAlignmentAnalysis,
  consistencyAnalysis,
  programsAnalysis,
  burnoutAnalysis,
  opportunityAnalysis,
] as const;

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
    const scope = TIMEFRAME_SCOPE[tf] ?? TIMEFRAME_SCOPE.daily;
    const result = await callGemini(ctx, autonomy, undefined, scope);
    const insights = result.response.insights;
    if (!insights || insights.length === 0) return null;
    return insights.map(insightToReportCard);
  } catch {
    return null;
  }
}

function heuristicCards(data: ScheduleData, tf: DigestTimeframe): ReportCard[] {
  const allCards: ReportCard[] = [];
  for (const module of HEURISTIC_MODULES) {
    allCards.push(...module(data, tf));
  }
  allCards.sort((a, b) => (CARD_ORDER[a.kind] ?? 99) - (CARD_ORDER[b.kind] ?? 99));
  return allCards;
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

  const ai = await aiCards(data, tf);
  if (ai && ai.length > 0) {
    allCards = ai;
    generatedBy = "ai";
  } else {
    allCards = heuristicCards(data, tf);
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
