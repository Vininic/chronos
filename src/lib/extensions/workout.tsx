import { Dumbbell, Plus, Trash2, Check, Copy, GripVertical } from "lucide-react";
import { registerExtension } from "./registry";
import type { ExtensionContext } from "./types";

// ── Types ──────────────────────────────────────────────────────

export interface Exercise {
  name: string;
  sets: number;
  reps: number;
  weight?: string;
  notes?: string;
}

export interface WorkoutTemplate {
  name: string;
  exercises: Exercise[];
}

export interface WorkoutCategoryConfig {
  templates: WorkoutTemplate[];
  /** e.g. { "1": "A", "3": "B" } — day index (0=Sun) → template name */
  rotation?: Record<string, string>;
}

/** Per-block extension data: which template variant + completed sets */
export interface WorkoutBlockData {
  templateName: string;
  exercises: (Exercise & { done?: boolean; completedSets?: number })[];
}

// ── Guards ─────────────────────────────────────────────────────

function isCatConfig(v: unknown): v is WorkoutCategoryConfig {
  return typeof v === "object" && v !== null && "templates" in v;
}

function isBlockData(v: unknown): v is WorkoutBlockData {
  return typeof v === "object" && v !== null && "templateName" in v && "exercises" in v;
}

// ── Helpers ─────────────────────────────────────────────────────

function cloneExercises(exercises: Exercise[]): (Exercise & { done?: boolean; completedSets?: number })[] {
  return exercises.map((e) => ({ ...e, done: false, completedSets: 0 }));
}

function rotateTemplate(config: WorkoutCategoryConfig, day: number): string | null {
  if (!config.rotation) return null;
  const name = config.rotation[String(day)];
  if (!name) return null;
  const tmpl = config.templates.find((t) => t.name === name);
  return tmpl?.name ?? null;
}

function getTemplate(config: WorkoutCategoryConfig, name: string): WorkoutTemplate | undefined {
  return config.templates.find((t) => t.name === name);
}

// ── Extension Registration ────────────────────────────────────

export function initWorkoutExtension() {
  registerExtension({
    id: "workout",
    label: "Workout",
    icon: Dumbbell,
    schema: {
      templateName: { type: "string", label: "Template" },
    },

    // Per-block badge
    renderBadge(data) {
      if (!isBlockData(data)) return null;
      return (
        <span className="flex items-center gap-0.5 text-[9px] tabular-nums text-muted-foreground/60">
          <Dumbbell className="h-2.5 w-2.5" />
          {data.templateName}
        </span>
      );
    },

    // Per-block details in BlockDetailsDialog
    renderDetails(data) {
      if (!isBlockData(data) || data.exercises.length === 0) return null;
      return (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
            <Dumbbell className="h-3 w-3" />
            {data.templateName}
          </div>
          {data.exercises.map((ex, i) => (
            <div key={i} className="flex items-center gap-1.5 text-[11px]">
              {ex.done ? (
                <Check className="h-3 w-3 text-secondary shrink-0" />
              ) : (
                <span className="h-3 w-3 rounded-sm border border-muted-foreground/30 shrink-0" />
              )}
              <span className={ex.done ? "line-through text-muted-foreground/50" : ""}>
                {ex.name}
              </span>
              <span className="text-[9px] text-muted-foreground/50 ml-auto">
                {ex.sets}×{ex.reps}{ex.weight ? ` @ ${ex.weight}` : ""}
              </span>
            </div>
          ))}
        </div>
      );
    },

    // Per-block editor in ComposeBlockDialog / BlockEditDialog
    renderEditor(data, onChange) {
      return <WorkoutBlockEditor data={data} onChange={onChange} />;
    },

    // Category config editor in category settings
    renderCategoryConfig(config, onChange) {
      return <WorkoutConfigEditor config={config} onChange={onChange} />;
    },

    // Full sheet view
    renderSheet(blockData, ctx) {
      return <WorkoutSheet blockData={blockData} ctx={ctx} />;
    },

    // Actions
    renderActions(ctx) {
      return [
        {
          id: "generate-week",
          label: "Generate Week",
          icon: Copy,
          run: (c: ExtensionContext) => {
            const catId = ctx.categoryId;
            const config = ctx.categoryConfig;
            if (!isCatConfig(config) || config.templates.length === 0) return;
            const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
            const today = new Date(ctx.selectedDate);
            const monday = new Date(today);
            monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
            for (let i = 0; i < 5; i++) {
              const day = monday.getDay();
              const tmplName = rotateTemplate(config, day);
              if (!tmplName) continue;
              const tmpl = getTemplate(config, tmplName);
              if (!tmpl) continue;
              const dateStr = monday.toISOString().slice(0, 10);
              ctx.addCommitment({
                date: dateStr,
                start: "09:00",
                end: "10:00",
                kind: catId,
                title: `${DAY_LABELS[day]} — ${tmplName}`,
                extensions: {
                  workout: {
                    templateName: tmplName,
                    exercises: cloneExercises(tmpl.exercises),
                  },
                },
              });
              monday.setDate(monday.getDate() + 1);
            }
          },
        },
      ];
    },

    // Default per-block data when creating a block for a bound category
    generateBlockData(categoryConfig, day) {
      if (!isCatConfig(categoryConfig)) return null;
      if (day !== undefined && categoryConfig.rotation) {
        const tmplName = rotateTemplate(categoryConfig, day);
        if (tmplName) {
          const tmpl = getTemplate(categoryConfig, tmplName);
          if (tmpl) {
            return { templateName: tmplName, exercises: cloneExercises(tmpl.exercises) };
          }
        }
      }
      const first = categoryConfig.templates[0];
      if (!first) return null;
      return { templateName: first.name, exercises: cloneExercises(first.exercises) };
    },
  });
}

// ── Inline Editors ───────────────────────────────────────────

function WorkoutBlockEditor({
  data,
  onChange,
}: {
  data: unknown;
  onChange: (next: unknown) => void;
}) {
  const block = isBlockData(data) ? data : { templateName: "", exercises: [] };

  function toggleExercise(idx: number) {
    const next = { ...block, exercises: block.exercises.map((ex, i) => i === idx ? { ...ex, done: !ex.done } : ex) };
    onChange(next);
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-medium text-muted-foreground">{block.templateName || "Untitled"}</span>
      </div>
      <div className="space-y-0.5 max-h-[120px] overflow-y-auto">
        {block.exercises.map((ex, i) => (
          <div key={i} className="flex items-center gap-1 group">
            <button type="button" onClick={() => toggleExercise(i)} className="shrink-0">
              {ex.done ? <Check className="h-3 w-3 text-secondary" /> : <span className="block h-3 w-3 rounded-sm border border-muted-foreground/30" />}
            </button>
            <span className={`flex-1 text-[11px] truncate ${ex.done ? "line-through text-muted-foreground/50" : ""}`}>
              {ex.name}
            </span>
            <span className="text-[9px] text-muted-foreground/50">{ex.sets}×{ex.reps}{ex.weight ? ` @ ${ex.weight}` : ""}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function WorkoutConfigEditor({
  config,
  onChange,
}: {
  config: unknown;
  onChange: (next: unknown) => void;
}) {
  const cfg = isCatConfig(config) ? config : { templates: [] as WorkoutTemplate[], rotation: {} as Record<string, string> };

  function setTemplates(templates: WorkoutTemplate[]) {
    onChange({ ...cfg, templates });
  }

  function setRotation(day: string, name: string) {
    const next = { ...(cfg.rotation ?? {}) };
    if (name) next[day] = name;
    else delete next[day];
    onChange({ ...cfg, rotation: next, templates: cfg.templates });
  }

  function addTemplate() {
    setTemplates([...cfg.templates, { name: "", exercises: [] }]);
  }

  function removeTemplate(idx: number) {
    setTemplates(cfg.templates.filter((_, i) => i !== idx));
  }

  function updateTemplate(idx: number, patch: Partial<WorkoutTemplate>) {
    setTemplates(cfg.templates.map((t, i) => i === idx ? { ...t, ...patch } : t));
  }

  function addExercise(tmplIdx: number) {
    updateTemplate(tmplIdx, {
      exercises: [...cfg.templates[tmplIdx].exercises, { name: "", sets: 3, reps: 10 }],
    });
  }

  function removeExercise(tmplIdx: number, exIdx: number) {
    updateTemplate(tmplIdx, {
      exercises: cfg.templates[tmplIdx].exercises.filter((_, i) => i !== exIdx),
    });
  }

  function updateExercise(tmplIdx: number, exIdx: number, patch: Partial<Exercise>) {
    updateTemplate(tmplIdx, {
      exercises: cfg.templates[tmplIdx].exercises.map((e, i) => i === exIdx ? { ...e, ...patch } : e),
    });
  }

  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="space-y-2">
      {/* Rotation */}
      <div>
        <div className="text-[10px] font-medium text-muted-foreground mb-1">Weekly Rotation</div>
        <div className="flex flex-wrap gap-1">
          {DAYS.map((day, idx) => (
            <div key={day} className="flex items-center gap-0.5">
              <span className="text-[9px] text-muted-foreground/50 w-5 text-right">{day}</span>
              <select
                value={cfg.rotation?.[String(idx)] ?? ""}
                onChange={(e) => setRotation(String(idx), e.target.value)}
                className="w-14 h-6 rounded border border-border/40 bg-card text-[10px] px-1 outline-none"
              >
                <option value="">—</option>
                {cfg.templates.map((t, i) => (
                  <option key={i} value={t.name}>{t.name || `T${i + 1}`}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* Templates */}
      <div className="space-y-1">
        <div className="text-[10px] font-medium text-muted-foreground">Templates</div>
        {cfg.templates.map((tmpl, ti) => (
          <div key={ti} className="rounded border border-border/40 p-2 space-y-1.5">
            <div className="flex items-center gap-1">
              <input
                value={tmpl.name}
                onChange={(e) => updateTemplate(ti, { name: e.target.value })}
                placeholder="Template name (A, B, C...)"
                className="flex-1 h-6 rounded border border-border/30 bg-transparent px-1.5 text-[10px] outline-none"
              />
              <button type="button" onClick={() => removeTemplate(ti)} className="shrink-0 text-muted-foreground/40 hover:text-destructive">
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
            <div className="space-y-0.5">
              {tmpl.exercises.map((ex, ei) => (
                <div key={ei} className="flex items-center gap-1">
                  <GripVertical className="h-2.5 w-2.5 text-muted-foreground/30 shrink-0" />
                  <input
                    value={ex.name}
                    onChange={(e) => updateExercise(ti, ei, { name: e.target.value })}
                    placeholder="Exercise"
                    className="flex-1 h-6 rounded border border-border/30 bg-transparent px-1.5 text-[10px] outline-none min-w-0"
                  />
                  <input
                    type="number"
                    value={ex.sets}
                    onChange={(e) => updateExercise(ti, ei, { sets: Number(e.target.value) })}
                    className="w-8 h-6 rounded border border-border/30 bg-transparent px-1 text-[9px] text-center outline-none"
                    title="Sets"
                  />
                  <span className="text-[9px] text-muted-foreground/40">×</span>
                  <input
                    type="number"
                    value={ex.reps}
                    onChange={(e) => updateExercise(ti, ei, { reps: Number(e.target.value) })}
                    className="w-8 h-6 rounded border border-border/30 bg-transparent px-1 text-[9px] text-center outline-none"
                    title="Reps"
                  />
                  <input
                    value={ex.weight ?? ""}
                    onChange={(e) => updateExercise(ti, ei, { weight: e.target.value })}
                    placeholder="Wt"
                    className="w-12 h-6 rounded border border-border/30 bg-transparent px-1 text-[9px] outline-none"
                    title="Weight"
                  />
                  <button type="button" onClick={() => removeExercise(ti, ei)} className="shrink-0 text-muted-foreground/30 hover:text-destructive">
                    <Trash2 className="h-2.5 w-2.5" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => addExercise(ti)}
                className="flex items-center gap-0.5 text-[9px] text-muted-foreground/40 hover:text-secondary transition-colors"
              >
                <Plus className="h-2.5 w-2.5" /> Add exercise
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={addTemplate}
          className="w-full border border-dashed border-border/40 rounded py-2 text-[10px] text-muted-foreground/40 hover:text-muted-foreground hover:border-border transition-colors flex items-center justify-center gap-1"
        >
          <Plus className="h-3 w-3" /> Add Template
        </button>
      </div>
    </div>
  );
}

// ── Sheet View ───────────────────────────────────────────────

function WorkoutSheet({
  blockData,
  ctx,
}: {
  blockData: unknown;
  ctx: ExtensionContext;
}) {
  const data = isBlockData(blockData) ? blockData : null;
  if (!data || data.exercises.length === 0) {
    return <p className="text-sm text-muted-foreground italic">No workout data.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-primary">{data.templateName}</span>
      </div>
      <div className="space-y-2">
        {data.exercises.map((ex, i) => (
          <WorkoutExerciseRow key={i} exercise={ex} index={i} />
        ))}
      </div>
      <div className="text-[10px] text-muted-foreground/40 text-center pt-2 border-t border-border/20">
        {ctx.routines.length + ctx.commitments.length} blocks in schedule
      </div>
    </div>
  );
}

function WorkoutExerciseRow({
  exercise,
  index,
}: {
  exercise: Exercise & { done?: boolean; completedSets?: number };
  index: number;
}) {
  return (
    <div className="rounded-lg border border-border/40 p-3 space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-muted-foreground/50 font-mono w-4">{index + 1}</span>
        <span className="text-sm font-medium text-primary flex-1">{exercise.name}</span>
        <span className="text-xs text-muted-foreground/60 tabular-nums">
          {exercise.sets}×{exercise.reps}
          {exercise.weight ? ` @ ${exercise.weight}` : ""}
        </span>
        {exercise.done && <Check className="h-4 w-4 text-secondary" />}
      </div>
      {exercise.notes && (
        <p className="text-[10px] text-muted-foreground/50 ml-6">{exercise.notes}</p>
      )}
      <div className="flex items-center gap-1 ml-6">
        {Array.from({ length: exercise.sets }, (_, si) => (
          <span
            key={si}
            className={`h-4 w-4 rounded border text-[8px] grid place-items-center transition-colors ${
              (exercise.completedSets ?? 0) > si
                ? "bg-secondary border-secondary text-secondary-foreground"
                : "border-muted-foreground/30 text-transparent"
            }`}
          >
            {si + 1}
          </span>
        ))}
      </div>
    </div>
  );
}
