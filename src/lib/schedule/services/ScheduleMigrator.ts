import type { Category, CategoryRole, Commitment, Goal, Preset, RoutineBlock, ScheduleData } from "../types";
import type { TreeNode, WorkspaceStructure, WorkspaceRuntime } from "../types";
import { isGoalTrackingValid, isGoalPeriodValid, getDefaultGoalTracking, getDefaultGoalPeriod } from "../types";
import type { Locale } from "@/lib/i18n/dictionaries";
import { isDefaultCategoryDescription, isDefaultCategoryLabel } from "@/lib/i18n/scheduleText";
import { migrateSleepSchedule, normalizeSleepWindow } from "../sleep";
import { SCHEMA_VERSION } from "../ports/ScheduleRepository";

const FALLBACK_TONES = ["sky", "violet", "coral", "mint", "peach", "amber", "emerald", "indigo", "rose", "lime"];

function pickDefaultTone(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash) + id.charCodeAt(i) | 0;
  return FALLBACK_TONES[Math.abs(hash) % FALLBACK_TONES.length];
}

function migrateWorkspaceCategory(c: unknown) {
  if ((c as Record<string, unknown>).workspace) return c;
  if ((c as Record<string, unknown>).extensionId === "gym" && (c as Record<string, unknown>).extensionConfig) {
    const cfg = (c as Record<string, unknown>).extensionConfig as { templates?: unknown[]; rotation?: unknown };
    const templates: TreeNode[] = (cfg.templates ?? []).map((tpl: unknown) => {
      const t = tpl as { name?: string; groups?: unknown[] };
      return {
        name: t.name,
        children: (t.groups ?? []).map((group: unknown) => {
          const g = group as { name?: string; exercises?: unknown[] };
          return {
            name: g.name,
            children: (g.exercises ?? []).map((ex: unknown) => {
              const e = ex as { name?: string; series?: unknown[] };
              return {
                name: e.name,
                children: (e.series ?? []).map((s: unknown, si: number) => {
                  const series = s as { instruction?: string; restMin?: number };
                  return {
                    name: `Set ${si + 1}`,
                    fields: { instruction: series.instruction, restMin: series.restMin },
                  };
                }),
              };
            }),
          };
        }),
      };
    });
    return {
      ...(c as Record<string, unknown>),
      workspace: {
        levels: [
          { key: "group", label: "Muscle Group", labelPlural: "Muscle Groups", fields: [{ name: "name", label: "Name", type: "text" as const }] },
          { key: "exercise", label: "Exercise", labelPlural: "Exercises", fields: [{ name: "name", label: "Name", type: "text" as const }] },
          { key: "set", label: "Set", labelPlural: "Sets", fields: [{ name: "instruction", label: "Instruction", type: "text" as const }, { name: "restMin", label: "Rest (min)", type: "number" as const }], tracking: { type: "boolean" as const, default: false, label: "Done" } },
        ],
        display: { summary: "{active} · {done}/{total}", nextStep: "{instruction} · {restMin}min rest", progress: "boolean" as const },
        templates,
        rotation: cfg.rotation ?? {},
      } as WorkspaceStructure,
    };
  }
  return c;
}

function migrateWorkspaceBlockRuntime(b: unknown) {
  const block = b as Record<string, unknown>;
  if (block.workspace) return b;
  if (block.extensions) {
    const ext = block.extensions as Record<string, unknown>;
    const runtime = ext["gym"] ?? ext;
    const rt = runtime as Record<string, unknown>;
    if (runtime && (rt.templateName || rt.completedSets)) {
      return { ...block, workspace: { templateName: rt.templateName ?? "", completedSets: rt.completedSets ?? {} } as WorkspaceRuntime };
    }
  }
  return b;
}

export function normalizeNamingModel(data: ScheduleData, locale: Locale): ScheduleData {
  // Derive category roles for legacy data: focus from the existing
  // focusCategoryIds list, recovery from the legacy "recovery" id, else neutral.
  const focusIds = new Set(data.meta.focusCategoryIds ?? []);
  const categories = data.categories.map((c) => {
    const labelCustom = c.labelCustom ?? (!isDefaultCategoryLabel(c.id, c.label) ? c.label : undefined);
    const descriptionCustom = c.descriptionCustom ?? (!isDefaultCategoryDescription(c.description) ? c.description : undefined);
    const role: CategoryRole = c.role ?? (focusIds.has(c.id) ? "focus" : c.id === "recovery" ? "recovery" : "neutral");
    return migrateWorkspaceCategory({ id: c.id, label: c.label, labelCustom, descriptionCustom, tone: c.tone ?? pickDefaultTone(c.id), color: c.color, role, description: c.description, extensionId: c.extensionId, extensionConfig: c.extensionConfig, workspace: c.workspace });
  });

  const routine = data.routine
    // Strip legacy boundary sleep blocks — sleep is now a schedule concept, not routine blocks
    .filter((r) => r.kind !== "sleep" || r.id.startsWith("r-custom-sleep"))
    .map((r) => migrateWorkspaceBlockRuntime({
      ...r,
      endsNextDay: r.endsNextDay ?? r.end <= r.start,
    }));

  const sleepSchedule = migrateSleepSchedule(data);

  // v5→v6: "count" merged into "numeric"; enforce kind×tracking×period matrix
  const goals: Goal[] = (data.goals ?? []).map((g) => {
    const kind = ((g.kind as string) === "count" ? "numeric" : g.kind) as Goal["kind"];
    const tracking = isGoalTrackingValid(kind, g.tracking as Goal["tracking"])
      ? (g.tracking as Goal["tracking"])
      : getDefaultGoalTracking(kind);
    const period = isGoalPeriodValid(kind, tracking, g.period as Goal["period"])
      ? (g.period as Goal["period"])
      : getDefaultGoalPeriod(kind, tracking);
    return { ...g, kind, tracking, period };
  });

  return {
    ...data,
    categories: categories as Category[],
    routine: routine as RoutineBlock[],
    commitments: (data.commitments ?? []).map((c) => migrateWorkspaceBlockRuntime(c)) as Commitment[],
    presets: (data.presets ?? []).map((p) => migrateWorkspaceBlockRuntime(p)) as Preset[],
    goals,
    suggestions: data.suggestions ?? [],
    progressSnapshots: data.progressSnapshots ?? [],
    meta: {
      ...data.meta,
      version: SCHEMA_VERSION,
      enforceSleepBoundary: data.meta.enforceSleepBoundary ?? true,
      focusCategoryIds: data.meta.focusCategoryIds ?? ((data.meta as { focusCategoryId?: string }).focusCategoryId ? [(data.meta as { focusCategoryId?: string }).focusCategoryId!] : undefined),
      sleepSchedule,
      sleepWindow: normalizeSleepWindow(data), // keep for legacy compat
    },
  };
}
