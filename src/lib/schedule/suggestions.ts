import type { RoutineBlock, ScheduleData, Suggestion } from "./types";
import { timeToMinutes } from "./types";
import { sortedDayBlocks, findGap, getDayLabel } from "./helpers";
import { DICTIONARIES, type Locale } from "@/lib/i18n/dictionaries";

export function generateLocalSuggestions(data: ScheduleData, locale: Locale = "en"): Suggestion[] {
  const sugg = DICTIONARIES[locale].chronos.store.suggestions;
  const suggestions: Suggestion[] = [];
  const weekdays = [1, 2, 3, 4, 5];

  for (const day of weekdays) {
    const dayBlocks = sortedDayBlocks(data.routine, day);
    const hasDeep = dayBlocks.some((b) => b.kind === "deep");
    if (!hasDeep) {
      const slot = findGap(data.routine, day, data.meta.workdayStart, data.meta.workdayEnd, 60);
      if (slot) {
        suggestions.push({
          id: `s-gap-${day}`,
          title: sugg.gapTitle(getDayLabel(day, locale)),
          detail: sugg.gapDetail,
          impact: sugg.gapImpact,
          priority: "high",
          patch: {
            type: "add-routine",
            block: {
              day,
              start: slot.start,
              end: slot.end,
              kind: "deep",
              title: "Deep session",
            },
          },
        });
      }
    }
  }

  for (const day of weekdays) {
    const dayBlocks = sortedDayBlocks(data.routine, day);
    const meetingMin = dayBlocks
      .filter((b) => b.kind === "meeting")
      .reduce((sum, b) => sum + Math.max(0, timeToMinutes(b.end) - timeToMinutes(b.start)), 0);
    const deepMin = dayBlocks
      .filter((b) => b.kind === "deep")
      .reduce((sum, b) => sum + Math.max(0, timeToMinutes(b.end) - timeToMinutes(b.start)), 0);
    if (meetingMin >= 120 && deepMin < 90) {
      const slot = findGap(data.routine, day, "13:00", data.meta.workdayEnd, 45);
      if (slot) {
        suggestions.push({
          id: `s-balance-${day}`,
          title: sugg.rebalanceTitle(getDayLabel(day, locale)),
          detail: sugg.rebalanceDetail,
          impact: sugg.rebalanceImpact,
          priority: "med",
          patch: {
            type: "add-routine",
            block: {
              day,
              start: slot.start,
              end: slot.end,
              kind: "deep",
              title: sugg.rebalanceBlockTitle,
            },
          },
        });
      }
    }
  }

  const lightDays = weekdays.filter((day) => sortedDayBlocks(data.routine, day).length < 2);
  if (lightDays.length > 0) {
    const day = lightDays[0];
    const slot = findGap(data.routine, day, "07:00", "10:30", 30);
    if (slot) {
      suggestions.push({
        id: `s-partial-${day}`,
        title: sugg.partialTitle,
        detail: sugg.partialDetail,
        impact: sugg.partialImpact,
        priority: "med",
        patch: {
          type: "add-routine",
          block: {
            day,
            start: slot.start,
            end: slot.end,
            kind: "ritual",
            title: sugg.partialBlockTitle,
          },
        },
      });
    }
  }

  const deepWeekdays = new Set(
    data.routine.filter((r) => r.kind === "deep" && r.day >= 1 && r.day <= 5).map((r) => r.day),
  ).size;
  if (deepWeekdays < 4) {
    const candidates = [2, 4]
      .map((day) => {
        const slot = findGap(data.routine, day, "08:00", "12:30", 75);
        if (!slot) return null;
        return {
          day,
          start: slot.start,
          end: slot.end,
          kind: "deep" as const,
          title: sugg.structureBlockTitle,
        };
      })
      .filter(Boolean) as Omit<RoutineBlock, "id">[];

    if (candidates.length > 0) {
      suggestions.push({
        id: "s-week-structure",
        title: sugg.structureTitle,
        detail: sugg.structureDetail,
        impact: sugg.structureImpact,
        priority: "high",
        patch: { type: "add-routines", blocks: candidates },
      });
    }
  }

  return suggestions.slice(0, 8);
}
