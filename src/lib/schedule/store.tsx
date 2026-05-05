import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import seed from "@/data/schedule.json";
import type { Commitment, RoutineBlock, ScheduleData, Suggestion } from "./types";

const STORAGE_KEY = "chronos.schedule.v1";

function load(): ScheduleData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as ScheduleData;
  } catch {}
  return seed as ScheduleData;
}

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

interface Ctx {
  data: ScheduleData;
  addRoutine: (b: Omit<RoutineBlock, "id">) => void;
  updateRoutine: (id: string, patch: Partial<RoutineBlock>) => void;
  removeRoutine: (id: string) => void;
  addCommitment: (c: Omit<Commitment, "id">) => void;
  removeCommitment: (id: string) => void;
  updateCommitment: (id: string, patch: Partial<Commitment>) => void;
  applySuggestion: (id: string) => void;
  deferSuggestion: (id: string) => void;
  resetToSeed: () => void;
  replace: (next: ScheduleData) => void;
}

const ScheduleCtx = createContext<Ctx | null>(null);

export function ScheduleProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<ScheduleData>(() => load());

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
  }, [data]);

  const addRoutine = useCallback((b: Omit<RoutineBlock, "id">) => {
    setData((d) => ({ ...d, routine: [...d.routine, { ...b, id: uid("r") }] }));
  }, []);
  const updateRoutine = useCallback((id: string, patch: Partial<RoutineBlock>) => {
    setData((d) => ({ ...d, routine: d.routine.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
  }, []);
  const removeRoutine = useCallback((id: string) => {
    setData((d) => ({ ...d, routine: d.routine.filter((r) => r.id !== id) }));
  }, []);
  const addCommitment = useCallback((c: Omit<Commitment, "id">) => {
    setData((d) => ({ ...d, commitments: [...d.commitments, { ...c, id: uid("c") }] }));
  }, []);
  const removeCommitment = useCallback((id: string) => {
    setData((d) => ({ ...d, commitments: d.commitments.filter((c) => c.id !== id) }));
  }, []);
  const updateCommitment = useCallback((id: string, patch: Partial<Commitment>) => {
    setData((d) => ({ ...d, commitments: d.commitments.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  }, []);

  const applySuggestion = useCallback((id: string) => {
    setData((d) => {
      const s = d.suggestions.find((x) => x.id === id);
      if (!s) return d;
      let routine = d.routine;
      if (s.patch?.type === "add-routine") {
        routine = [...routine, { ...s.patch.block, id: uid("r") }];
      } else if (s.patch?.type === "remove-routine") {
        const m = s.patch.match;
        routine = routine.filter(
          (r) => !(Object.keys(m) as (keyof RoutineBlock)[]).every((k) => r[k] === m[k]),
        );
      }
      return { ...d, routine, suggestions: d.suggestions.filter((x) => x.id !== id) };
    });
  }, []);

  const deferSuggestion = useCallback((id: string) => {
    setData((d) => ({ ...d, suggestions: d.suggestions.filter((x) => x.id !== id) }));
  }, []);

  const resetToSeed = useCallback(() => setData(seed as ScheduleData), []);
  const replace = useCallback((next: ScheduleData) => setData(next), []);

  const value = useMemo(
    () => ({ data, addRoutine, updateRoutine, removeRoutine, addCommitment, removeCommitment, updateCommitment, applySuggestion, deferSuggestion, resetToSeed, replace }),
    [data, addRoutine, updateRoutine, removeRoutine, addCommitment, removeCommitment, updateCommitment, applySuggestion, deferSuggestion, resetToSeed, replace],
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
    id: r.id, title: r.title, start: r.start, end: r.end, kind: r.kind, source: "routine" as const,
  }));
  const fromCommit = data.commitments.filter((c) => c.date === iso).map((c) => ({
    id: c.id, title: c.title, start: c.start, end: c.end, kind: c.kind, source: "commitment" as const,
  }));
  return [...fromRoutine, ...fromCommit].sort((a, b) => a.start.localeCompare(b.start));
}