import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import seedEn from "@/data/schedule-en.json";
import seedPt from "@/data/schedule-pt.json";
import type { Category, Commitment, RoutineBlock, ScheduleData, Suggestion } from "./types";
import { timeToMinutes } from "./types";
import type { Locale } from "@/lib/i18n/dictionaries";
import { DICTIONARIES } from "@/lib/i18n/dictionaries";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { isDefaultCategoryDescription, isDefaultCategoryLabel } from "@/lib/i18n/scheduleText";

const STORAGE_KEY = "chronos.schedule.v1";

function getSeedForLocale(locale: Locale): ScheduleData {
  return locale === "pt" ? (seedPt as ScheduleData) : (seedEn as ScheduleData);
}

function load(locale: Locale = "en"): ScheduleData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalizeNamingModel(JSON.parse(raw) as ScheduleData);
  } catch {}
  return normalizeNamingModel(getSeedForLocale(locale));
}

function normalizeNamingModel(data: ScheduleData): ScheduleData {
  const categories = data.categories.map((c) => {
    const labelCustom = c.labelCustom ?? (!isDefaultCategoryLabel(c.id, c.label) ? c.label : undefined);
    const descriptionCustom = c.descriptionCustom ?? (!isDefaultCategoryDescription(c.description) ? c.description : undefined);
    return { ...c, labelCustom, descriptionCustom };
  });

  return { ...data, categories };
}

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function overlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  const as = timeToMinutes(aStart);
  const ae = timeToMinutes(aEnd);
  const bs = timeToMinutes(bStart);
  const be = timeToMinutes(bEnd);
  return as < be && bs < ae;
}

function dayFromIsoDate(isoDate: string) {
  return new Date(`${isoDate}T00:00:00`).getDay();
}

function minutesToTime(min: number) {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, min));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function clamp(v: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, v));
}

function getConflictMessage(type: "blockRoutine" | "blockCommitment" | "routineCommitment", title: string, start: string, end: string, locale: Locale): string {
  const conflicts = DICTIONARIES[locale].chronos.store.conflicts;
  return conflicts[type](title, start, end);
}

function getDayLabel(day: number, locale: Locale): string {
  return DICTIONARIES[locale].common.days.long[day];
}

function dayKindMin(data: ScheduleData, day: number, kind: RoutineBlock["kind"]) {
  return data.routine
    .filter((r) => r.day === day && r.kind === kind)
    .reduce((sum, r) => sum + Math.max(0, timeToMinutes(r.end) - timeToMinutes(r.start)), 0);
}

function buildLedger(data: ScheduleData): ScheduleData["ledger"] {
  const totalRoutineMin = data.routine.reduce((sum, r) => sum + Math.max(0, timeToMinutes(r.end) - timeToMinutes(r.start)), 0);
  const deepMin = data.routine
    .filter((r) => r.kind === "deep")
    .reduce((sum, r) => sum + Math.max(0, timeToMinutes(r.end) - timeToMinutes(r.start)), 0);
  const recoveryMin = data.routine
    .filter((r) => r.kind === "recovery")
    .reduce((sum, r) => sum + Math.max(0, timeToMinutes(r.end) - timeToMinutes(r.start)), 0);

  const deepWeekdays = new Set(
    data.routine.filter((r) => r.kind === "deep" && r.day >= 1 && r.day <= 5).map((r) => r.day),
  ).size;

  const depthScore = clamp(Math.round((deepMin / (10 * 60)) * 100));
  const cadenceScore = clamp(Math.round((deepWeekdays / 5) * 100));
  const recoveryScore = clamp(Math.round((recoveryMin / (3 * 60)) * 100));
  const compositionScore = clamp(
    Math.round(depthScore * 0.45 + cadenceScore * 0.3 + recoveryScore * 0.25),
  );

  const metrics = [
    { label: "Depth", value: depthScore },
    { label: "Cadence", value: cadenceScore },
    { label: "Recovery", value: recoveryScore },
  ];

  const deepHours = Array.from({ length: 14 }, (_, i) => {
    const d = i % 7;
    return Number((dayKindMin(data, d, "deep") / 60).toFixed(1));
  });
  const recoveryHours = Array.from({ length: 14 }, (_, i) => {
    const d = i % 7;
    return Number((dayKindMin(data, d, "recovery") / 60).toFixed(1));
  });

  void totalRoutineMin;
  return { compositionScore, metrics, deepHours, recoveryHours };
}

function sortedDayBlocks(routine: RoutineBlock[], day: number) {
  return routine
    .filter((r) => r.day === day)
    .slice()
    .sort((a, b) => a.start.localeCompare(b.start));
}

function findGap(routine: RoutineBlock[], day: number, startBound: string, endBound: string, minDuration = 60) {
  const blocks = sortedDayBlocks(routine, day);
  let cursor = timeToMinutes(startBound);
  const endLimit = timeToMinutes(endBound);

  for (const b of blocks) {
    const bs = timeToMinutes(b.start);
    const be = timeToMinutes(b.end);
    if (bs - cursor >= minDuration) {
      return { start: minutesToTime(cursor), end: minutesToTime(Math.min(bs, cursor + Math.max(minDuration, 90))) };
    }
    cursor = Math.max(cursor, be);
  }

  if (endLimit - cursor >= minDuration) {
    return { start: minutesToTime(cursor), end: minutesToTime(Math.min(endLimit, cursor + Math.max(minDuration, 90))) };
  }

  return null;
}

function generateLocalSuggestions(data: ScheduleData, locale: Locale = "en"): Suggestion[] {
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
      .filter((x): x is Omit<RoutineBlock, "id"> => Boolean(x));

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

function withDerived(data: ScheduleData, regenerateSuggestions = false, locale: Locale = "en"): ScheduleData {
  return {
    ...data,
    ledger: buildLedger(data),
    suggestions: regenerateSuggestions ? generateLocalSuggestions(data, locale) : data.suggestions,
  };
}

interface Ctx {
  data: ScheduleData;
  addRoutine: (b: Omit<RoutineBlock, "id">) => string | null;
  updateRoutine: (id: string, patch: Partial<RoutineBlock>) => string | null;
  removeRoutine: (id: string) => void;
  addCommitment: (c: Omit<Commitment, "id">) => string | null;
  removeCommitment: (id: string) => void;
  updateCommitment: (id: string, patch: Partial<Commitment>) => string | null;
  updateCategory: (id: Category["id"], patch: Partial<Pick<Category, "label" | "labelCustom" | "description" | "descriptionCustom" | "tone">>) => void;
  resetCategoryNaming: (id: Category["id"]) => void;
  applySuggestion: (id: string) => void;
  deferSuggestion: (id: string) => void;
  refreshSuggestions: () => void;
  resetToSeed: () => void;
  replace: (next: ScheduleData) => void;
}

const ScheduleCtx = createContext<Ctx | null>(null);

export function ScheduleProvider({ children }: { children: ReactNode }) {
  const { locale } = useI18n();
  const [data, setData] = useState<ScheduleData>(() => {
    const initial = load(locale);
    return withDerived(initial, true, locale);
  });

  // Wrapper to automatically include locale when calling withDerived
  const withDerivedLocale = useCallback((d: ScheduleData, regen = false) => withDerived(d, regen, locale), [locale]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
  }, [data]);

  // When locale changes, if user hasn't customized their schedule, reinitialize with new seed
  useEffect(() => {
    const userHasCustomized = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return false;
        const original = JSON.parse(stored) as ScheduleData;
        const current = data;
        // Simple check: if routine/categories/meta have been modified beyond the initial seed
        // For now, we'll just check if localStorage exists (user has made any changes)
        return true; // Assume they have customized if they have stored data
      } catch {
        return false;
      }
    };

    // Don't auto-reload seed if user has customized their data
    if (!userHasCustomized()) {
      const newSeed = load(locale);
      setData(withDerivedLocale(newSeed, true));
    }
  }, [locale, data, withDerivedLocale]);

  const addRoutine = useCallback((b: Omit<RoutineBlock, "id">) => {
    const conflict = data.routine.find((r) => r.day === b.day && overlap(r.start, r.end, b.start, b.end));
    if (conflict) {
      return `Conflicts with "${conflict.title}" (${conflict.start}-${conflict.end}).`;
    }
    setData((d) => withDerived({ ...d, routine: [...d.routine, { ...b, id: uid("r") }] }));
    return null;
  }, [data]);
  const updateRoutine = useCallback((id: string, patch: Partial<RoutineBlock>) => {
    const current = data.routine.find((r) => r.id === id);
    if (!current) return null;
    const next = { ...current, ...patch };
    const conflict = data.routine.find(
      (r) => r.id !== id && r.day === next.day && overlap(r.start, r.end, next.start, next.end),
    );
    if (conflict) {
      return `Conflicts with "${conflict.title}" (${conflict.start}-${conflict.end}).`;
    }
    setData((d) => withDerived({ ...d, routine: d.routine.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
    return null;
  }, [data]);
  const removeRoutine = useCallback((id: string) => {
    setData((d) => withDerived({ ...d, routine: d.routine.filter((r) => r.id !== id) }));
  }, []);
  const addCommitment = useCallback((c: Omit<Commitment, "id">) => {
    const dateDay = dayFromIsoDate(c.date);
    const conflictCommitment = data.commitments.find((x) => x.date === c.date && overlap(x.start, x.end, c.start, c.end));
    if (conflictCommitment) {
      return `Conflicts with "${conflictCommitment.title}" (${conflictCommitment.start}-${conflictCommitment.end}).`;
    }
    const conflictRoutine = data.routine.find((r) => r.day === dateDay && overlap(r.start, r.end, c.start, c.end));
    if (conflictRoutine) {
      return `Conflicts with routine "${conflictRoutine.title}" (${conflictRoutine.start}-${conflictRoutine.end}).`;
    }
    setData((d) => withDerived({ ...d, commitments: [...d.commitments, { ...c, id: uid("c") }] }));
    return null;
  }, [data]);
  const removeCommitment = useCallback((id: string) => {
    setData((d) => withDerived({ ...d, commitments: d.commitments.filter((c) => c.id !== id) }));
  }, []);
  const updateCommitment = useCallback((id: string, patch: Partial<Commitment>) => {
    const current = data.commitments.find((c) => c.id === id);
    if (!current) return null;
    const next = { ...current, ...patch };
    const dateDay = dayFromIsoDate(next.date);
    const conflictCommitment = data.commitments.find(
      (c) => c.id !== id && c.date === next.date && overlap(c.start, c.end, next.start, next.end),
    );
    if (conflictCommitment) {
      return `Conflicts with "${conflictCommitment.title}" (${conflictCommitment.start}-${conflictCommitment.end}).`;
    }
    const conflictRoutine = data.routine.find((r) => r.day === dateDay && overlap(r.start, r.end, next.start, next.end));
    if (conflictRoutine) {
      return `Conflicts with routine "${conflictRoutine.title}" (${conflictRoutine.start}-${conflictRoutine.end}).`;
    }
    setData((d) => withDerived({ ...d, commitments: d.commitments.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
    return null;
  }, [data]);

  const updateCategory = useCallback((id: Category["id"], patch: Partial<Pick<Category, "label" | "labelCustom" | "description" | "descriptionCustom" | "tone">>) => {
    setData((d) => withDerived({
      ...d,
      categories: d.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
  }, []);

  const resetCategoryNaming = useCallback((id: Category["id"]) => {
    setData((d) =>
      withDerived({
        ...d,
        categories: d.categories.map((c) =>
          c.id === id ? { ...c, labelCustom: undefined, descriptionCustom: undefined } : c,
        ),
      }),
    );
  }, []);

  const applySuggestion = useCallback((id: string) => {
    setData((d) => {
      const s = d.suggestions.find((x) => x.id === id);
      if (!s) return d;
      let routine = d.routine;
      if (s.patch?.type === "add-routine") {
        routine = [...routine, { ...s.patch.block, id: uid("r") }];
      } else if (s.patch?.type === "add-routines") {
        routine = [...routine, ...s.patch.blocks.map((b) => ({ ...b, id: uid("r") }))];
      } else if (s.patch?.type === "remove-routine") {
        const m = s.patch.match;
        routine = routine.filter(
          (r) => !(Object.keys(m) as (keyof RoutineBlock)[]).every((k) => r[k] === m[k]),
        );
      }
      return withDerived({ ...d, routine, suggestions: d.suggestions.filter((x) => x.id !== id) });
    });
  }, []);

  const deferSuggestion = useCallback((id: string) => {
    setData((d) => withDerived({ ...d, suggestions: d.suggestions.filter((x) => x.id !== id) }));
  }, []);

  const refreshSuggestions = useCallback(() => {
    setData((d) => withDerived(d, true, locale));
  }, [locale]);

  const resetToSeed = useCallback(() => setData(withDerived(normalizeNamingModel(getSeedForLocale(locale) as ScheduleData), true, locale)), [locale]);
  const replace = useCallback((next: ScheduleData) => setData(withDerived(normalizeNamingModel(next), true, locale)), [locale]);

  const value = useMemo(
    () => ({
      data,
      addRoutine,
      updateRoutine,
      removeRoutine,
      addCommitment,
      removeCommitment,
      updateCommitment,
      updateCategory,
      resetCategoryNaming,
      applySuggestion,
      deferSuggestion,
      refreshSuggestions,
      resetToSeed,
      replace,
    }),
    [
      data,
      addRoutine,
      updateRoutine,
      removeRoutine,
      addCommitment,
      removeCommitment,
      updateCommitment,
      updateCategory,
      resetCategoryNaming,
      applySuggestion,
      deferSuggestion,
      refreshSuggestions,
      resetToSeed,
      replace,
    ],
  );
  return <ScheduleCtx.Provider value={value}>{children}</ScheduleCtx.Provider>;
}

export function useSchedule() {
  const ctx = useContext(ScheduleCtx);
  if (!ctx) throw new Error("useSchedule must be used within ScheduleProvider");
  return ctx;
}

/** Build today's agenda from routine + commitments for a given date. */
export function buildAgendaForDate(data: ScheduleData, date: Date) {
  const day = date.getDay();
  const iso = date.toISOString().slice(0, 10);
  const fromRoutine = data.routine.filter((r) => r.day === day).map((r) => ({
    id: r.id, title: r.title, titleCustom: r.titleCustom, start: r.start, end: r.end, kind: r.kind, source: "routine" as const,
  }));
  const fromCommit = data.commitments.filter((c) => c.date === iso).map((c) => ({
    id: c.id, title: c.title, titleCustom: c.titleCustom, start: c.start, end: c.end, kind: c.kind, source: "commitment" as const,
  }));
  return [...fromRoutine, ...fromCommit].sort((a, b) => a.start.localeCompare(b.start));
}