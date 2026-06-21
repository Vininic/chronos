import type { ScheduleData, Goal, Category, WorkspaceStructure } from "@/lib/schedule/types";
import { durationMin, computeStreak } from "@/lib/schedule/types";
import { calcProgress } from "@/lib/schedule/workspace-engine";
import { getLogsLastNDays } from "@/lib/schedule/dailyLog";
import type {
  ScheduleContext,
  AiBlock,
  AiSleepBlock,
  AiSleepMetrics,
  AiCommitment,
  AiGoal,
  AiCategory,
  AiProgram,
  AiNote,
  AiMetrics,
  AutonomyLevel,
  DailyStats,
  WeeklyStats,
  HistoricalCompletion,
} from "./ScheduleContext";

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function parseTime(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m ?? 0);
}

function nowInMinutes(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

export function buildContext(
  data: ScheduleData,
  autonomy: AutonomyLevel = "balanced",
): ScheduleContext {
  const today = todayIso();
  const nowMin = nowInMinutes();

  const focusedCategories = new Set(data.meta.focusCategoryIds ?? []);
  const categoryMap = new Map<string, Category>();
  for (const c of data.categories ?? []) {
    categoryMap.set(c.id, c);
  }

  /* ── Blocks (routine + commitment sources) ─────── */
  const blocks: AiBlock[] = [];

  for (const r of data.routine ?? []) {
    const ws = r.workspace as Record<string, unknown> | undefined;
    const cat = categoryMap.get(r.kind);
    const struct = cat?.workspace;
    const progress = struct ? calcProgress(ws ?? {}, struct) : { done: 0, total: 0 };
    const inProgress = !!(ws?._sessionStarted) && !(ws?._sessionEnded);
    const tplName = ws?.templateName as string | undefined;

    blocks.push({
      id: r.id,
      title: r.title ?? "",
      titleCustom: r.titleCustom,
      category: r.kind,
      start: r.start,
      end: r.end,
      durationMin: durationMin(r.start, r.end),
      notes: r.notes,
      hasProgram: !!struct,
      programName: tplName,
      programProgress: progress,
      inProgress,
      complete: progress.total > 0 && progress.done >= progress.total,
      source: "routine",
      day: r.day,
      isFocus: focusedCategories.has(r.kind),
    });
  }

  for (const c of data.commitments ?? []) {
    if (!c.date) continue;
    if (c.date < today) continue;
    const ws = c.workspace as Record<string, unknown> | undefined;
    const cat = categoryMap.get(c.kind);
    const struct = cat?.workspace;
    const progress = struct ? calcProgress(ws ?? {}, struct) : { done: 0, total: 0 };
    const inProgress = !!(ws?._sessionStarted) && !(ws?._sessionEnded);

    blocks.push({
      id: c.id,
      title: c.title ?? "",
      titleCustom: c.titleCustom,
      category: c.kind,
      start: c.start,
      end: c.end,
      durationMin: durationMin(c.start, c.end),
      notes: c.notes,
      hasProgram: !!struct,
      programName: ws?.templateName as string | undefined,
      programProgress: progress,
      inProgress,
      complete: progress.total > 0 && progress.done >= progress.total,
      source: "commitment",
      isFocus: focusedCategories.has(c.kind),
    });
  }

  blocks.sort((a, b) => parseTime(a.start) - parseTime(b.start));

  /* ── Sleep ─────────────────────────────────────── */
  const sleepBlocks: AiSleepBlock[] = [];
  const sleepSchedule = data.meta.sleepSchedule ?? [];

  for (const entry of sleepSchedule) {
    if (!entry.start || !entry.end) continue;
    for (const d of entry.days ?? [0, 1, 2, 3, 4, 5, 6]) {
      sleepBlocks.push({
        id: `sleep-${d}-${entry.start}-${entry.end}`,
        start: entry.start,
        end: entry.end,
        durationMin: durationMin(entry.start, entry.end),
        isSleepBoundary: true,
      });
    }
  }

  const validSleeps = sleepBlocks.filter((s) => s.durationMin > 0);
  const avgSleepMin =
    validSleeps.length > 0
      ? Math.round(validSleeps.reduce((s, b) => s + b.durationMin, 0) / validSleeps.length)
      : 0;
  const sleepDebtMin = avgSleepMin ? Math.max(0, 8 * 60 - avgSleepMin) : 0;

  const sleepMetrics: AiSleepMetrics = {
    averageDurationMin: avgSleepMin,
    consistency: validSleeps.length > 0 ? 1 - Math.min(1, sleepDebtMin / (8 * 60)) : 0,
    debtMin: sleepDebtMin,
    schedule: sleepSchedule
      .filter((e) => e.start && e.end)
      .map((e) => ({ start: e.start!, end: e.end!, days: e.days ?? [0, 1, 2, 3, 4, 5, 6] })),
  };

  /* ── Commitments ───────────────────────────────── */
  const commitments: AiCommitment[] = [];

  for (const c of data.commitments ?? []) {
    const now = new Date();
    const endT = parseTime(c.end);
    const isDone = c.date
      ? c.date < today || (c.date === today && endT <= nowMin)
      : false;

    commitments.push({
      id: c.id,
      title: c.title ?? "",
      titleCustom: c.titleCustom,
      category: c.kind,
      start: c.start,
      end: c.end,
      date: c.date,
      endDate: c.endDate,
      notes: c.notes,
      commitmentType: "fixed",
      done: isDone,
    });
  }

  /* ── Goals ─────────────────────────────────────── */
  const goals: AiGoal[] = [];

  for (const g of data.goals ?? []) {
    const deadlineDate = g.deadline ? new Date(g.deadline + "T00:00:00") : null;
    const daysRemaining = deadlineDate ? daysBetween(new Date(), deadlineDate) : undefined;
    const streak = computeStreak(g as unknown as Goal, today);

    // Compute current progress
    let done = 0;
    let total = 0;
    if (g.kind === "deadline" && g.deadline && g.deadline <= today) {
      done = 1;
      total = 1;
    } else if (g.tracking === "goalBlock") {
      done = (g.blocks ?? []).filter((b) => b.done).length;
      total = Math.max(1, (g.blocks ?? []).length);
    } else if (g.tracking === "subTask") {
      done = (g.subTasks ?? []).filter((s) => s.done).length;
      total = Math.max(1, (g.subTasks ?? []).length);
    } else {
      done = 0;
      total = 1;
    }

    goals.push({
      id: g.id,
      title: g.title,
      description: g.description,
      kind: g.kind,
      tracking: g.tracking,
      period: g.period,
      categoryId: g.categoryId,
      target: g.target,
      unit: g.unit,
      weight: g.weight,
      deadline: g.deadline,
      progress: total > 0 ? Math.min(1, done / total) : 0,
      daysRemaining: daysRemaining,
      streak,
    });
  }

  /* ── Categories ────────────────────────────────── */
  const categories: AiCategory[] = [];
  for (const c of data.categories ?? []) {
    const ws = c.workspace as WorkspaceStructure | undefined;
    const progCount = ws?.templates?.length ?? 0;
    const weeklyCount = (data.routine ?? []).filter((r) => r.kind === c.id).length;

    categories.push({
      id: c.id,
      label: c.label ?? c.id,
      description: c.description ?? "",
      color: c.color,
      hasProgram: !!ws,
      programCount: progCount,
      weeklyBlockCount: weeklyCount,
    });
  }

  /* ── Programs ──────────────────────────────────── */
  const programs: AiProgram[] = [];
  for (const c of data.categories ?? []) {
    const ws = c.workspace as WorkspaceStructure | undefined;
    if (!ws?.templates) continue;
    for (const tpl of ws.templates) {
      const allRuntimes = [
        ...(data.routine ?? []).filter((r) => r.kind === c.id),
        ...(data.commitments ?? []).filter((cm) => cm.kind === c.id),
      ];
      let total = 0;
      let done = 0;
      let lastUsed: string | undefined;

      for (const item of allRuntimes) {
        const rt = item.workspace as Record<string, unknown> | undefined;
        if (rt?.templateName === tpl.name) {
          const p = calcProgress(rt ?? {}, ws);
          total += p.total;
          done += p.done;
          if (!lastUsed) lastUsed = today;
        }
      }

      programs.push({
        categoryId: c.id,
        categoryLabel: c.label ?? c.id,
        templateName: tpl.name,
        done,
        total,
        lastUsed,
      });
    }
  }

  /* ── Notes ─────────────────────────────────────── */
  const notes: AiNote[] = [];
  for (const r of data.routine ?? []) {
    if (r.notes?.trim()) {
      notes.push({
        sourceType: "block",
        sourceId: r.id,
        sourceTitle: r.title ?? "",
        text: r.notes,
        date: today,
        category: r.kind,
      });
    }
  }
  for (const c of data.commitments ?? []) {
    if (c.notes?.trim()) {
      notes.push({
        sourceType: "commitment",
        sourceId: c.id,
        sourceTitle: c.title ?? "",
        text: c.notes,
        date: c.date ?? today,
        category: c.kind,
      });
    }
  }

  /* ── Metrics ───────────────────────────────────── */
  const focusTimeMin = blocks
    .filter((b) => focusedCategories.has(b.category))
    .reduce((s, b) => s + b.durationMin, 0);
  const recoveryTimeMin = blocks
    .filter((b) => b.category === "recovery")
    .reduce((s, b) => s + b.durationMin, 0);
  const totalBlockMin = blocks.reduce((s, b) => s + b.durationMin, 0);
  const overloadScore = totalBlockMin > 0 ? Math.min(1, focusTimeMin / totalBlockMin) : 0;

  const metrics: AiMetrics = {
    compositionScore: data.ledger?.compositionScore ?? 0,
    scheduledHours: data.ledger?.scheduledHours ?? [],
    focusTimeMin,
    recoveryTimeMin,
    consistencyScore: sleepMetrics.consistency,
    overloadScore,
  };

  /* ── Historical daily logs ──────────────────────── */
  const pastLogs = getLogsLastNDays(30);

  /* ── Daily stats (today + last 30 days from log) ── */
  const todayEntry: DailyStats = {
    date: today,
    totalBlocks: blocks.length,
    completedBlocks: blocks.filter((b) => b.complete).length,
    totalMinutes: blocks.reduce((s, b) => s + b.durationMin, 0),
    focusMinutes: focusTimeMin,
    recoveryMinutes: recoveryTimeMin,
    sleepMinutes: avgSleepMin,
  };

  const dailyStats: DailyStats[] = [
    ...pastLogs.map((l) => ({
      date: l.date,
      totalBlocks: l.blocks.length,
      completedBlocks: l.blocks.length, // scheduled = treated as planned
      totalMinutes: l.totalMin,
      focusMinutes: l.focusMin,
      recoveryMinutes: l.recoveryMin,
      sleepMinutes: avgSleepMin,
    })),
    todayEntry,
  ];

  /* ── Weekly stats (last 12 weeks from log + current) */
  const weekBuckets = new Map<string, { totalMin: number; focusMin: number; recoveryMin: number; days: number }>();

  for (const l of pastLogs) {
    const d = new Date(l.date + "T12:00:00");
    const dow = d.getDay();
    const mon = new Date(d);
    mon.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
    const wk = formatDate(mon);
    const b = weekBuckets.get(wk) ?? { totalMin: 0, focusMin: 0, recoveryMin: 0, days: 0 };
    b.totalMin += l.totalMin;
    b.focusMin += l.focusMin;
    b.recoveryMin += l.recoveryMin;
    b.days += 1;
    weekBuckets.set(wk, b);
  }

  const weeklyStats: WeeklyStats[] = Array.from(weekBuckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([wk, s]) => ({
      weekStart: wk,
      totalMinutes: s.totalMin,
      focusMinutes: s.focusMin,
      recoveryMinutes: s.recoveryMin,
      avgSleepMinutes: avgSleepMin,
      completionRate: 1,
      dayCount: s.days,
    }));

  // Add current week so there's always at least one entry
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  const currentWeekStart = formatDate(monday);
  if (!weekBuckets.has(currentWeekStart)) {
    weeklyStats.push({
      weekStart: currentWeekStart,
      totalMinutes: blocks.reduce((s, b) => s + b.durationMin, 0),
      focusMinutes: focusTimeMin,
      recoveryMinutes: recoveryTimeMin,
      avgSleepMinutes: avgSleepMin,
      completionRate: blocks.length > 0 ? blocks.filter((b) => b.complete).length / blocks.length : 0,
      dayCount: 1,
    });
  }

  /* ── Historical completion (last 14 days from log) ─ */
  const historicalCompletion: HistoricalCompletion[] = [];

  for (const l of pastLogs.slice(-14)) {
    for (const b of l.blocks) {
      historicalCompletion.push({
        date: l.date,
        blockId: `${l.date}-${b.kind}`,
        blockTitle: b.title,
        category: b.kind,
        durationMin: b.durationMin,
        completed: true,
      });
    }
  }

  // Also include today's program-tracked blocks (existing logic)
  for (const r of data.routine ?? []) {
    const ws = r.workspace as Record<string, unknown> | undefined;
    const cat = categoryMap.get(r.kind);
    const struct = cat?.workspace;
    const p = struct ? calcProgress(ws ?? {}, struct) : { done: 0, total: 0 };
    const isComplete = p.total > 0 && p.done >= p.total;
    if (p.total > 0) {
      historicalCompletion.push({
        date: today,
        blockId: r.id,
        blockTitle: r.title ?? "",
        category: r.kind,
        durationMin: durationMin(r.start, r.end),
        completed: isComplete,
      });
    }
  }

  /* ── Final context ─────────────────────────────── */
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    owner: data.meta.owner,
    cycle: data.meta.cycle,
    workday: { start: data.meta.workdayStart, end: data.meta.workdayEnd },
    blocks,
    sleep: { blocks: sleepBlocks, metrics: sleepMetrics },
    commitments,
    goals,
    categories,
    programs,
    notes,
    metrics,
    dailyStats,
    weeklyStats,
    historicalCompletion,
    autonomy,
  };
}
