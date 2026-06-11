import { describe, it, expect } from "vitest";
import { selectTemplate, initRuntime, calcProgress, toggleTracking, getTrackingLeaves } from "@/lib/schedule/workspace-engine";
import type { WorkspaceStructure } from "@/lib/schedule/types";

const workoutStructure: WorkspaceStructure = {
  levels: [
    { key: "group", label: "Muscle Group", labelPlural: "Muscle Groups", fields: [{ name: "name", label: "Name", type: "text" }] },
    { key: "exercise", label: "Exercise", labelPlural: "Exercises", fields: [{ name: "name", label: "Name", type: "text" }] },
    { key: "set", label: "Set", labelPlural: "Sets", fields: [{ name: "instruction", label: "Instruction", type: "text" }, { name: "restMin", label: "Rest (min)", type: "number" }], tracking: { type: "boolean", default: false, label: "Done" } },
  ],
  display: { summary: "{active} · {done}/{total}", progress: "boolean" },
  templates: [
    {
      name: "Upper A",
      children: [
        {
          name: "Chest",
          children: [
            {
              name: "Bench Press",
              children: [
                { name: "Set 1", fields: { instruction: "8 reps", restMin: 90 } },
                { name: "Set 2", fields: { instruction: "8 reps", restMin: 90 } },
                { name: "Set 3", fields: { instruction: "6 reps", restMin: 120 } },
              ],
            },
            {
              name: "Incline Dumbbell",
              children: [
                { name: "Set 1", fields: { instruction: "10 reps", restMin: 60 } },
                { name: "Set 2", fields: { instruction: "10 reps", restMin: 60 } },
              ],
            },
          ],
        },
        {
          name: "Back",
          children: [
            {
              name: "Pull Up",
              children: [
                { name: "Set 1", fields: { instruction: "AMRAP", restMin: 90 } },
                { name: "Set 2", fields: { instruction: "AMRAP", restMin: 90 } },
              ],
            },
          ],
        },
      ],
    },
    {
      name: "Upper B",
      children: [
        {
          name: "Shoulders",
          children: [
            {
              name: "OHP",
              children: [
                { name: "Set 1", fields: { instruction: "8 reps", restMin: 90 } },
                { name: "Set 2", fields: { instruction: "8 reps", restMin: 90 } },
              ],
            },
          ],
        },
      ],
    },
  ],
  rotation: {},
};

describe("selectTemplate", () => {
  it("returns first template when no name given", () => {
    const tpl = selectTemplate(workoutStructure);
    expect(tpl?.name).toBe("Upper A");
  });

  it("returns matching template by name", () => {
    const tpl = selectTemplate(workoutStructure, "Upper B");
    expect(tpl?.name).toBe("Upper B");
  });

  it("falls back to first template if name not found", () => {
    const tpl = selectTemplate(workoutStructure, "NonExistent");
    expect(tpl?.name).toBe("Upper A");
  });

  it("returns undefined for empty templates", () => {
    const empty: WorkspaceStructure = { levels: [], display: { summary: "", progress: "boolean" }, templates: [] };
    expect(selectTemplate(empty)).toBeUndefined();
  });
});

describe("initRuntime", () => {
  it("creates runtime with template name and tracking defaults", () => {
    const rt = initRuntime(workoutStructure, "Upper A") as Record<string, unknown>;
    expect(rt.templateName).toBe("Upper A");
    expect(rt.tracking).toBeDefined();
  });

  it("initializes all tracking leaves as false (boolean default)", () => {
    const rt = initRuntime(workoutStructure, "Upper A") as Record<string, unknown>;
    const tracking = rt.tracking as Record<string, unknown>;
    expect(Object.keys(tracking)).toHaveLength(7); // 3 + 2 + 2 sets
    for (const v of Object.values(tracking)) {
      expect(v).toBe(false);
    }
  });

  it("returns empty object for empty structure", () => {
    const empty: WorkspaceStructure = { levels: [], display: { summary: "", progress: "boolean" }, templates: [] };
    expect(initRuntime(empty)).toEqual({});
  });

  it("uses template name without tracking level", () => {
    const noTracking: WorkspaceStructure = { levels: [{ key: "a", label: "A", labelPlural: "As", fields: [{ name: "n", label: "N", type: "text" }] }], display: { summary: "", progress: "boolean" }, templates: [{ name: "Test", children: [{ name: "Item" }] }] };
    const rt = initRuntime(noTracking, "Test") as Record<string, unknown>;
    expect(rt.templateName).toBe("Test");
    expect(rt.tracking).toBeUndefined();
  });
});

describe("calcProgress", () => {
  it("returns 0/0 for no tracking data", () => {
    expect(calcProgress({}, workoutStructure)).toEqual({ done: 0, total: 0 });
  });

  it("counts truthy values as done", () => {
    const rt = initRuntime(workoutStructure, "Upper A") as Record<string, unknown>;
    const tracking = rt.tracking as Record<string, boolean>;
    const keys = Object.keys(tracking);
    tracking[keys[0]] = true;
    tracking[keys[1]] = true;
    tracking[keys[2]] = true;
    expect(calcProgress(rt as Record<string, unknown>, workoutStructure)).toEqual({ done: 3, total: 7 });
  });

  it("counts zero as not done", () => {
    const rt = initRuntime(workoutStructure, "Upper A") as Record<string, unknown>;
    expect(calcProgress(rt as Record<string, unknown>, workoutStructure)).toEqual({ done: 0, total: 7 });
  });
});

describe("toggleTracking", () => {
  it("toggles boolean values", () => {
    const rt = initRuntime(workoutStructure, "Upper A");
    const key = Object.keys((rt as Record<string, unknown>).tracking as Record<string, unknown>)[0];
    const toggled = toggleTracking(rt, key);
    expect((toggled as Record<string, unknown>).tracking).not.toBe((rt as Record<string, unknown>).tracking);
    const t = (toggled as Record<string, unknown>).tracking as Record<string, boolean>;
    expect(t[key]).toBe(true);
  });
});

describe("getTrackingLeaves", () => {
  it("returns all leaves with paths and values", () => {
    const rt = initRuntime(workoutStructure, "Upper A");
    const leaves = getTrackingLeaves(workoutStructure, rt);
    expect(leaves).toHaveLength(7);
    expect(leaves[0].key).toBe("Chest/Bench Press/Set 1");
    expect(leaves[0].label).toBe("Set 1");
    expect(leaves[0].parentPath).toEqual(["Chest", "Bench Press"]);
    expect(leaves[0].parentLabel).toBe("Bench Press");
    expect(leaves[0].value).toBe(false);
  });
});
