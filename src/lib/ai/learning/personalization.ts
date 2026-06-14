import type { LearningProfile } from "./types";
import type { Suggestion } from "@/lib/ai/suggestions/suggestionEngine";
import type { ScheduleData } from "@/lib/schedule/types";
import { timeToMinutes } from "@/lib/schedule/types";

export interface PersonalizedSuggestionResult {
  suggestions: Suggestion[];
  adjustments: string[];
}

export function personalizeSuggestions(
  suggestions: Suggestion[],
  profile: LearningProfile,
  data: ScheduleData
): PersonalizedSuggestionResult {
  const adjustments: string[] = [];
  const categoryMap = new Map(
    data.categories.map((c) => [c.id, c.label])
  );

  const preferredCategories = new Set(profile.commonlyUsedCategories);
  const neglectedSet = new Set(profile.neglectedCategories);

  let working = suggestions.map((s) => ({ ...s }));

  const boosted: string[] = [];
  working = working.map((s) => {
    const matchedCategory = findCategoryInSuggestion(s, data);
    if (matchedCategory && preferredCategories.has(matchedCategory)) {
      boosted.push(categoryMap.get(matchedCategory) ?? matchedCategory);
      return {
        ...s,
        priority: s.priority === "high" ? "high" : s.priority === "medium" ? "high" : "medium" as const,
      };
    }
    return s;
  });

  if (boosted.length > 0) {
    adjustments.push(`Boosted suggestions for: ${boosted.join(", ")}`);
  }

  const filtered: Suggestion[] = [];
  for (const s of working) {
    const matchedCategory = findCategoryInSuggestion(s, data);
    if (matchedCategory && neglectedSet.has(matchedCategory)) {
      adjustments.push(
        `Filtered out suggestion for neglected category "${categoryMap.get(matchedCategory) ?? matchedCategory}"`
      );
      continue;
    }
    filtered.push(s);
  }
  working = filtered;

  if (profile.categoryPreferences.length > 0) {
    const prefMap = new Map(profile.categoryPreferences.map((p) => [p.categoryId, p]));
    working = working.map((s) => {
      const catId = findCategoryInSuggestion(s, data);
      if (!catId) return s;
      const pref = prefMap.get(catId);
      if (!pref) return s;
      const startMin = timeToMinutes(profile.preferredWorkStart);
      const endMin = timeToMinutes(profile.preferredWorkEnd);
      const contextNote = `You usually do ${categoryMap.get(catId) ?? catId} around ${profile.preferredWorkStart}`;
      const detailWithContext = s.detail.includes(contextNote)
        ? s.detail
        : `${s.detail} · ${contextNote}`;
      adjustments.push(`Adjusted time context for "${categoryMap.get(catId) ?? catId}" to preferred window`);
      return { ...s, detail: detailWithContext };
    });
  }

  const profileNote =
    `Based on ${profile.totalDaysTracked} tracked days, ` +
    `your average completion rate is ${Math.round(profile.averageCompletionRate * 100)}%`;
  adjustments.push(profileNote);

  if (profile.averageFocusMinutesPerDay > 0) {
    adjustments.push(
      `You average ${Math.round(profile.averageFocusMinutesPerDay / 60 * 10) / 10}h of focus per day`
    );
  }

  working.sort((a, b) => {
    const rank = { high: 3, medium: 2, low: 1 };
    return (rank[b.priority] ?? 1) - (rank[a.priority] ?? 1);
  });

  return { suggestions: working, adjustments };
}

function findCategoryInSuggestion(s: Suggestion, data: ScheduleData): string | null {
  const titleLower = s.title.toLowerCase();
  const detailLower = s.detail.toLowerCase();

  for (const cat of data.categories) {
    const labelLower = cat.label.toLowerCase();
    if (titleLower.includes(labelLower) || detailLower.includes(labelLower)) {
      return cat.id;
    }
  }

  for (const cat of data.categories) {
    const idLower = cat.id.toLowerCase();
    if (titleLower.includes(idLower) || detailLower.includes(idLower)) {
      return cat.id;
    }
  }

  return null;
}
