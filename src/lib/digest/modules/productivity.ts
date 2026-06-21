import type { ScheduleData } from "@/lib/schedule/types";
import type { ReportCard } from "../types";
import { fmtDur } from "@/lib/schedule/types";
import type { DigestContext, DigestBlock } from "./helpers";
import { WEEKDAY_NAMES, isFocusKind, minutesByWeekday, totalMinutes } from "./helpers";

function hourOf(b: DigestBlock): number {
  return parseInt(b.start.split(":")[0], 10);
}

export function productivityAnalysis(data: ScheduleData, ctx: DigestContext): ReportCard[] {
  const cards: ReportCard[] = [];
  if (ctx.blocks.length === 0) return cards;

  // ── Time-of-day distribution by minutes (category-agnostic) ─────────
  let morning = 0, afternoon = 0, evening = 0;
  for (const b of ctx.blocks) {
    const h = hourOf(b);
    if (h >= 5 && h < 12) morning += b.durationMin;
    else if (h >= 12 && h < 18) afternoon += b.durationMin;
    else evening += b.durationMin;
  }
  const total = morning + afternoon + evening;
  if (total > 0) {
    const slots = [
      { label: "morning", min: morning },
      { label: "afternoon", min: afternoon },
      { label: "evening", min: evening },
    ].sort((a, b) => b.min - a.min);
    const top = slots[0];
    if (top.min / total >= 0.5) {
      cards.push({
        kind: "productivity",
        severity: "insight",
        title: `${Math.round((top.min / total) * 100)}% of scheduled time is in the ${top.label}`,
        body: `Morning ${fmtDur(morning)} · afternoon ${fmtDur(afternoon)} · evening ${fmtDur(evening)}.`,
      });
    }
  }

  // ── Focus time (uses the user's own focus categories) ───────────────
  const focusIds = data.meta.focusCategoryIds ?? [];
  if (focusIds.length > 0) {
    const focusMin = ctx.blocks.filter((b) => isFocusKind(b.kind, data)).reduce((s, b) => s + b.durationMin, 0);
    if (focusMin > 0) {
      const perDay = focusMin / ctx.dayCount;
      const share = Math.round((focusMin / totalMinutes(ctx)) * 100);
      cards.push({
        kind: "productivity",
        severity: "insight",
        title: ctx.dayCount > 1
          ? `Averaging ${fmtDur(Math.round(perDay))} of focus work per day`
          : `${fmtDur(focusMin)} of focus work scheduled`,
        body: `Focus categories make up ${share}% of scheduled time this ${ctx.timeframe === "daily" ? "day" : "period"}.`,
      });
    }
  }

  // ── Busiest / lightest weekday (multi-day views only) ───────────────
  if (ctx.dayCount >= 5) {
    const byDay = minutesByWeekday(ctx);
    const present = ctx.days.map((d) => d.day);
    const entries = present.map((d) => ({ day: d, min: byDay.get(d) ?? 0 }));
    if (entries.length >= 2) {
      const sorted = [...entries].sort((a, b) => b.min - a.min);
      const heavy = sorted[0];
      const light = sorted[sorted.length - 1];
      if (heavy.min > 0 && heavy.min !== light.min) {
        cards.push({
          kind: "productivity",
          severity: "insight",
          title: `${WEEKDAY_NAMES[heavy.day]} is your heaviest day`,
          body: `${WEEKDAY_NAMES[heavy.day]} carries ${fmtDur(heavy.min)}, ${WEEKDAY_NAMES[light.day]} the lightest at ${fmtDur(light.min)}.`,
        });
      }
    }
  }

  return cards;
}
