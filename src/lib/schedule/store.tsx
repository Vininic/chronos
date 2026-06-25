import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import seedEn from "@/data/schedule-en.json";
import seedPt from "@/data/schedule-pt.json";
import type { Category, CategoryRole, Commitment, Goal, GoalBlock, Preset, RoutineBlock, ScheduleData, SleepCut, SleepScheduleEntry } from "./types";
import type { Locale } from "@/lib/i18n/dictionaries";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { LocalStorageScheduleRepository } from "./infrastructure/LocalStorageScheduleRepository";
import type { ScheduleRepository } from "./ports/ScheduleRepository";
import { normalizeNamingModel } from "./services/ScheduleMigrator";
import {
  withDerived,
  addRoutine as svcAddRoutine,
  updateRoutine as svcUpdateRoutine,
  removeRoutine as svcRemoveRoutine,
  addCommitment as svcAddCommitment,
  updateCommitment as svcUpdateCommitment,
  removeCommitment as svcRemoveCommitment,
  addPreset as svcAddPreset,
  removePreset as svcRemovePreset,
  updatePreset as svcUpdatePreset,
  addGoal as svcAddGoal,
  updateGoal as svcUpdateGoal,
  removeGoal as svcRemoveGoal,
  addGoalBlock as svcAddGoalBlock,
  updateGoalBlock as svcUpdateGoalBlock,
  removeGoalBlock as svcRemoveGoalBlock,
  toggleGoalBlock as svcToggleGoalBlock,
  addGoalSubTask as svcAddGoalSubTask,
  toggleGoalSubTask as svcToggleGoalSubTask,
  linkLooseCommitment as svcLinkLooseCommitment,
  generateGoalCommitments as svcGenerateGoalCommitments,
  trackBlockForGoal as svcTrackBlockForGoal,
  isBlockTrackedForAnyGoal as svcIsBlockTrackedForAnyGoal,
  getGoalsForDate as svcGetGoalsForDate,
  overallGoalProgress as svcOverallGoalProgress,
  recordProgressSnapshots as svcRecordProgressSnapshots,
  updateSleepWindow as svcUpdateSleepWindow,
  setSleepBoundaryEnforced as svcSetSleepBoundaryEnforced,
  setFocusCategories as svcSetFocusCategories,
  updateSleepSchedule as svcUpdateSleepSchedule,
  addSleepCut as svcAddSleepCut,
  removeSleepCut as svcRemoveSleepCut,
  updateCategory as svcUpdateCategory,
  setCategoryRole as svcSetCategoryRole,
  addCategory as svcAddCategory,
  removeCategory as svcRemoveCategory,
  resetCategoryNaming as svcResetCategoryNaming,
  reorderCategory as svcReorderCategory,
  applySuggestion as svcApplySuggestion,
  deferSuggestion as svcDeferSuggestion,
  pushMoveDayChain as svcPushMoveDayChain,
  replaceSchedule as svcReplaceSchedule,
} from "./services/ScheduleService";

function getSeedForLocale(locale: Locale): ScheduleData {
  return locale === "pt" ? (seedPt as unknown as ScheduleData) : (seedEn as unknown as ScheduleData);
}

function ensureCategories(data: ScheduleData): ScheduleData {
  for (const b of data.routine) {
    if (b.kind !== "sleep" && !data.categories.some((c) => c.id === b.kind)) {
      const label = b.kind.charAt(0).toUpperCase() + b.kind.slice(1);
      data.categories.push({ id: b.kind, label, tone: "neutral", description: `${label} activities.` });
    }
  }
  return data;
}

function seedData(locale: Locale): ScheduleData {
  return normalizeNamingModel(getSeedForLocale(locale), locale);
}

interface Ctx {
  data: ScheduleData;
  addRoutine: (b: Omit<RoutineBlock, "id">) => string | null;
  updateRoutine: (id: string, patch: Partial<RoutineBlock>) => string | null;
  removeRoutine: (id: string) => void;
  addCommitment: (c: Omit<Commitment, "id">) => string | null;
  removeCommitment: (id: string) => void;
  updateCommitment: (id: string, patch: Partial<Commitment>) => string | null;
  addPreset: (p: Omit<Preset, "id">) => string;
  removePreset: (id: string) => void;
  updatePreset: (id: string, patch: Partial<Preset>) => void;
  pushMoveDayChain: (date: Date, source: "routine" | "commitment", id: string, newStart: string, newEnd: string, dragDeltaMin?: number, dragEdge?: "top" | "bottom") => string | null;
  setSleepBoundaryEnforced: (enforced: boolean) => void;
  setFocusCategories: (ids: string[]) => void;
  updateSleepWindow: (patch: Partial<{ start: string; end: string }>) => void;
  updateSleepSchedule: (schedule: SleepScheduleEntry[]) => void;
  addSleepCut: (cut: Omit<SleepCut, never>) => void;
  removeSleepCut: (target: { date: string; start?: string; end?: string }) => void;
  updateCategory: (id: Category["id"], patch: Partial<Pick<Category, "label" | "labelCustom" | "description" | "descriptionCustom" | "tone" | "color" | "role" | "workspace">>) => void;
  setCategoryRole: (id: Category["id"], role: CategoryRole) => void;
  resetCategoryNaming: (id: Category["id"]) => void;
  addCategory: (category: Omit<Category, never>) => void;
  removeCategory: (id: Category["id"]) => void;
  reorderCategory: (id: Category["id"], newIndex: number) => void;
  applySuggestion: (id: string) => void;
  deferSuggestion: (id: string) => void;
  refreshSuggestions: () => void;
  resetToSeed: () => void;
  replace: (next: ScheduleData) => void;
  addGoal: (g: Omit<Goal, "id" | "blocks" | "subTasks" | "looseCommitmentIds" | "createdAt">) => string;
  recordProgressSnapshots: () => void;
  updateGoal: (id: string, patch: Partial<Goal>) => void;
  removeGoal: (id: string) => void;
  addGoalBlock: (goalId: string, b: Omit<GoalBlock, "id">) => string;
  updateGoalBlock: (goalId: string, blockId: string, patch: Partial<GoalBlock>) => void;
  removeGoalBlock: (goalId: string, blockId: string) => void;
  toggleGoalBlock: (goalId: string, blockId: string) => void;
  addGoalSubTask: (goalId: string, title: string) => void;
  toggleGoalSubTask: (goalId: string, subTaskId: string) => void;
  linkLooseCommitment: (goalId: string, commitmentId: string) => void;
  generateGoalCommitments: (goalId: string) => void;
  trackBlockForGoal: (goalId: string, blockKey: string) => void;
  isBlockTrackedForAnyGoal: (blockKey: string) => boolean;
  getGoalsForDate: (date: string) => Goal[];
  overallGoalProgress: () => number;
}

const ScheduleCtx = createContext<Ctx | null>(null);

export function ScheduleProvider({ children, repo }: { children: ReactNode; repo?: ScheduleRepository }) {
  const { locale } = useI18n();
  const repoInstance = useMemo(() => repo ?? new LocalStorageScheduleRepository(), [repo]);
  const [data, setData] = useState<ScheduleData>(() =>
    withDerived(seedData(locale), true, locale)
  );

  const withDerivedLocale = useCallback((d: ScheduleData, regen = false) => withDerived(d, regen, locale), [locale]);

  useEffect(() => {
    (async () => {
      try {
        const stored = await repoInstance.loadRaw();
        if (stored) {
          const loaded = ensureCategories(normalizeNamingModel(stored, locale));
          setData(withDerivedLocale(loaded, true));
        }
      } catch {
        // fall back to seed
      }
    })();
  }, [repoInstance, locale, withDerivedLocale]);

  useEffect(() => {
    repoInstance.save(data).catch(() => {});
  }, [data, repoInstance]);

  const addRoutine = useCallback((b: Omit<RoutineBlock, "id">) => {
    const result = svcAddRoutine(data, b);
    if (typeof result === "string") return result;
    setData((d) => withDerived(result));
    return null;
  }, [data]);

  const updateRoutine = useCallback((id: string, patch: Partial<RoutineBlock>) => {
    const result = svcUpdateRoutine(data, id, patch);
    if (typeof result === "string") return result;
    setData((d) => withDerived(result));
    return null;
  }, [data]);

  const removeRoutine = useCallback((id: string) => {
    setData((d) => withDerived(svcRemoveRoutine(data, id)));
  }, [data]);

  const addCommitment = useCallback((c: Omit<Commitment, "id">) => {
    const result = svcAddCommitment(data, c);
    if (typeof result === "string") return result;
    setData((d) => withDerived(result));
    return null;
  }, [data]);

  const removeCommitment = useCallback((id: string) => {
    setData((d) => withDerived(svcRemoveCommitment(data, id)));
  }, [data]);

  const updateCommitment = useCallback((id: string, patch: Partial<Commitment>) => {
    const result = svcUpdateCommitment(data, id, patch);
    if (typeof result === "string") return result;
    setData((d) => withDerived(result));
    return null;
  }, [data]);

  const addPreset = useCallback((p: Omit<Preset, "id">) => {
    const { data: result, id } = svcAddPreset(data, p);
    setData((d) => withDerived(result));
    return id;
  }, [data]);

  const removePreset = useCallback((id: string) => {
    setData((d) => withDerived(svcRemovePreset(data, id)));
  }, [data]);

  const updatePreset = useCallback((id: string, patch: Partial<Preset>) => {
    setData((d) => withDerived(svcUpdatePreset(data, id, patch)));
  }, [data]);

  const addGoal = useCallback((g: Omit<Goal, "id" | "blocks" | "subTasks" | "looseCommitmentIds" | "createdAt">) => {
    const { data: result, id } = svcAddGoal(data, g);
    setData((d) => withDerived(result));
    return id;
  }, [data]);

  const updateGoal = useCallback((id: string, patch: Partial<Goal>) => {
    setData((d) => withDerived(svcUpdateGoal(data, id, patch)));
  }, [data]);

  const removeGoal = useCallback((id: string) => {
    setData((d) => withDerived(svcRemoveGoal(data, id)));
  }, [data]);

  const addGoalBlock = useCallback((goalId: string, b: Omit<GoalBlock, "id">) => {
    const { data: result, id } = svcAddGoalBlock(data, goalId, b);
    setData((d) => withDerived(result));
    return id;
  }, [data]);

  const updateGoalBlock = useCallback((goalId: string, blockId: string, patch: Partial<GoalBlock>) => {
    setData((d) => withDerived(svcUpdateGoalBlock(data, goalId, blockId, patch)));
  }, [data]);

  const removeGoalBlock = useCallback((goalId: string, blockId: string) => {
    setData((d) => withDerived(svcRemoveGoalBlock(data, goalId, blockId)));
  }, [data]);

  const toggleGoalBlock = useCallback((goalId: string, blockId: string) => {
    setData((d) => withDerived(svcToggleGoalBlock(data, goalId, blockId)));
  }, [data]);

  const addGoalSubTask = useCallback((goalId: string, title: string) => {
    setData((d) => withDerived(svcAddGoalSubTask(data, goalId, title)));
  }, [data]);

  const toggleGoalSubTask = useCallback((goalId: string, subTaskId: string) => {
    setData((d) => withDerived(svcToggleGoalSubTask(data, goalId, subTaskId)));
  }, [data]);

  const linkLooseCommitment = useCallback((goalId: string, commitmentId: string) => {
    setData((d) => withDerived(svcLinkLooseCommitment(data, goalId, commitmentId)));
  }, [data]);

  const generateGoalCommitments = useCallback((goalId: string) => {
    setData((d) => withDerived(svcGenerateGoalCommitments(data, goalId)));
  }, [data]);

  const trackBlockForGoal = useCallback((goalId: string, blockKey: string) => {
    setData((d) => withDerived(svcTrackBlockForGoal(data, goalId, blockKey)));
  }, [data]);

  const isBlockTrackedForAnyGoal = useCallback((blockKey: string): boolean => {
    return svcIsBlockTrackedForAnyGoal(data, blockKey);
  }, [data]);

  const overallGoalProgress = useCallback(() => {
    return svcOverallGoalProgress(data);
  }, [data]);

  const getGoalsForDate = useCallback((date: string) => {
    return svcGetGoalsForDate(data, date);
  }, [data]);

  const recordProgressSnapshots = useCallback(() => {
    setData((d) => withDerived(svcRecordProgressSnapshots(data)));
  }, [data]);

  const pushMoveDayChain = useCallback((date: Date, source: "routine" | "commitment", id: string, newStart: string, newEnd: string, dragDeltaMin?: number, dragEdge?: "top" | "bottom") => {
    const result = svcPushMoveDayChain(data, date, source, id, newStart, newEnd, dragDeltaMin, dragEdge);
    if (typeof result === "string") return result;
    setData((d) => withDerived(result));
    return null;
  }, [data]);

  const updateSleepWindow = useCallback((patch: Partial<{ start: string; end: string }>) => {
    setData((d) => withDerived(svcUpdateSleepWindow(d, patch)));
  }, []);

  const setSleepBoundaryEnforced = useCallback((enforced: boolean) => {
    setData((d) => withDerived(svcSetSleepBoundaryEnforced(d, enforced, locale)));
  }, [locale]);

  const setFocusCategories = useCallback((ids: string[]) => {
    setData((d) => withDerived(svcSetFocusCategories(d, ids)));
  }, []);

  const updateSleepSchedule = useCallback((schedule: SleepScheduleEntry[]) => {
    setData((d) => withDerived(svcUpdateSleepSchedule(d, schedule)));
  }, []);

  const addSleepCut = useCallback((cut: SleepCut) => {
    setData((d) => withDerived(svcAddSleepCut(d, cut)));
  }, []);

  const removeSleepCut = useCallback((target: { date: string; start?: string; end?: string }) => {
    setData((d) => withDerived(svcRemoveSleepCut(d, target)));
  }, []);

  const updateCategory = useCallback((id: Category["id"], patch: Partial<Pick<Category, "label" | "labelCustom" | "description" | "descriptionCustom" | "tone" | "color" | "role" | "workspace">>) => {
    setData((d) => withDerived(svcUpdateCategory(d, id, patch)));
  }, []);

  const setCategoryRole = useCallback((id: Category["id"], role: CategoryRole) => {
    setData((d) => withDerived(svcSetCategoryRole(d, id, role)));
  }, []);

  const addCategory = useCallback((cat: Category) => {
    setData((d) => withDerived(svcAddCategory(d, cat)));
  }, []);

  const removeCategory = useCallback((id: Category["id"]) => {
    setData((d) => withDerived(svcRemoveCategory(d, id)));
  }, []);

  const resetCategoryNaming = useCallback((id: Category["id"]) => {
    setData((d) => withDerived(svcResetCategoryNaming(d, id)));
  }, []);

  const reorderCategory = useCallback((id: Category["id"], newIndex: number) => {
    setData((d) => withDerived(svcReorderCategory(d, id, newIndex)));
  }, []);

  const applySuggestion = useCallback((id: string) => {
    setData((d) => withDerived(svcApplySuggestion(d, id)));
  }, []);

  const deferSuggestion = useCallback((id: string) => {
    setData((d) => withDerived(svcDeferSuggestion(d, id)));
  }, []);

  const refreshSuggestions = useCallback(() => {
    setData((d) => withDerived(d, true, locale));
  }, [locale]);

  const resetToSeed = useCallback(() => setData(withDerived(normalizeNamingModel(getSeedForLocale(locale) as ScheduleData, locale), true, locale)), [locale]);

  const replace = useCallback((next: ScheduleData) => {
    setData((d) => withDerived(svcReplaceSchedule(d, next, locale), true, locale));
  }, [locale]);

  const value = useMemo(
    () => ({
      data,
      addRoutine,
      updateRoutine,
      removeRoutine,
      addCommitment,
      removeCommitment,
      updateCommitment,
      addPreset,
      removePreset,
      updatePreset,
      pushMoveDayChain,
      setSleepBoundaryEnforced,
      setFocusCategories,
      updateSleepWindow,
      updateSleepSchedule,
      addSleepCut,
      removeSleepCut,
      updateCategory,
      setCategoryRole,
      addCategory,
      removeCategory,
      reorderCategory,
      resetCategoryNaming,
      applySuggestion,
      deferSuggestion,
      refreshSuggestions,
      resetToSeed,
      replace,
      addGoal,
      updateGoal,
      removeGoal,
      addGoalBlock,
      updateGoalBlock,
      removeGoalBlock,
      toggleGoalBlock,
      addGoalSubTask,
      toggleGoalSubTask,
      linkLooseCommitment,
      generateGoalCommitments,
      trackBlockForGoal,
      isBlockTrackedForAnyGoal,
      getGoalsForDate,
      overallGoalProgress,
      recordProgressSnapshots,
    }),
    [
      data,
      addRoutine,
      updateRoutine,
      removeRoutine,
      addCommitment,
      removeCommitment,
      updateCommitment,
      addPreset,
      removePreset,
      updatePreset,
      pushMoveDayChain,
      setSleepBoundaryEnforced,
      setFocusCategories,
      updateSleepWindow,
      updateSleepSchedule,
      addSleepCut,
      removeSleepCut,
      updateCategory,
      setCategoryRole,
      addCategory,
      removeCategory,
      reorderCategory,
      resetCategoryNaming,
      applySuggestion,
      deferSuggestion,
      refreshSuggestions,
      resetToSeed,
      replace,
      addGoal,
      updateGoal,
      removeGoal,
      addGoalBlock,
      updateGoalBlock,
      removeGoalBlock,
      toggleGoalBlock,
      addGoalSubTask,
      toggleGoalSubTask,
      linkLooseCommitment,
      generateGoalCommitments,
      trackBlockForGoal,
      isBlockTrackedForAnyGoal,
      getGoalsForDate,
      overallGoalProgress,
      recordProgressSnapshots,
    ],
  );
  return <ScheduleCtx.Provider value={value}>{children}</ScheduleCtx.Provider>;
}

export function useSchedule() {
  const ctx = useContext(ScheduleCtx);
  if (!ctx) throw new Error("useSchedule must be used within ScheduleProvider");
  return ctx;
}

