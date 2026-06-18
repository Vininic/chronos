import type { ScheduleData } from "@/lib/schedule/types";
import type { Digest, DigestTimeframe, DigestColor, ReportCard } from "./types";
import { addDigest, getDigestMode, getLatestDigest } from "./store";
import { recoveryAnalysis } from "./modules/recovery";
import { productivityAnalysis } from "./modules/productivity";
import { scheduleQualityAnalysis } from "./modules/schedule-quality";
import { goalAlignmentAnalysis } from "./modules/goal-alignment";
import { consistencyAnalysis } from "./modules/consistency";
import { programsAnalysis } from "./modules/programs";
import { burnoutAnalysis } from "./modules/burnout";
import { opportunityAnalysis } from "./modules/opportunity";

const MODULES = [
  recoveryAnalysis,
  productivityAnalysis,
  scheduleQualityAnalysis,
  goalAlignmentAnalysis,
  consistencyAnalysis,
  programsAnalysis,
  burnoutAnalysis,
  opportunityAnalysis,
] as const;

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

function timeframeForDate(): DigestTimeframe {
  return "daily";
}

function generateId(): string {
  return `digest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildSummary(cards: ReportCard[]): string {
  if (cards.length === 0) return "No significant findings for this period.";

  const warnings = cards.filter((c) => c.severity === "warning");
  const opportunities = cards.filter((c) => c.severity === "opportunity");
  const insights = cards.filter((c) => c.severity === "insight" || c.severity === "trend");

  const parts: string[] = [];
  if (warnings.length > 0) {
    parts.push(`${warnings.length} warning${warnings.length > 1 ? "s" : ""} identified.`);
  }
  if (opportunities.length > 0) {
    parts.push(`${opportunities.length} improvement opportunit${opportunities.length > 1 ? "ies" : "y"} found.`);
  }
  if (insights.length > 0) {
    parts.push(`${insights.length} observation${insights.length > 1 ? "s" : ""} available.`);
  }

  const topCard = cards[0];
  return `${topCard.title}. ${topCard.body.slice(0, 120)}${topCard.body.length > 120 ? "..." : ""} ${parts.join(" ")}`;
}

function buildRecommendations(cards: ReportCard[]): string[] {
  const actionable = cards.filter((c) => c.actionable && c.severity !== "insight");
  return actionable.slice(0, 3).map((c) => c.body.split(".")[0] + ".");
}

function buildOpportunities(cards: ReportCard[]): { label: string; action?: string }[] {
  return cards
    .filter((c) => c.actionable && c.severity === "opportunity")
    .slice(0, 3)
    .map((c) => ({ label: c.title, action: c.title.toLowerCase().replace(/\s+/g, "-") }));
}

export function generateDigest(data: ScheduleData): Digest {
  const mode = getDigestMode();
  const today = new Date().toISOString().slice(0, 10);
  const timeframe = timeframeForDate();
  const color = TIMEFRAME_COLORS[timeframe];

  const allCards: ReportCard[] = [];
  for (const module of MODULES) {
    const cards = module(data);
    allCards.push(...cards);
  }

  allCards.sort((a, b) => (CARD_ORDER[a.kind] ?? 99) - (CARD_ORDER[b.kind] ?? 99));

  const digest: Digest = {
    id: generateId(),
    mode,
    timeframe,
    date: today,
    generatedAt: new Date().toISOString(),
    color,
    summary: buildSummary(allCards),
    cards: allCards,
    recommendations: buildRecommendations(allCards),
    opportunities: buildOpportunities(allCards),
  };

  addDigest(digest);
  return digest;
}
