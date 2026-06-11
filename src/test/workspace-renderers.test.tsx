import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { useState } from "react";
import { SessionView, BlockSessionBadge } from "@/components/dashboard/SessionView";
import { initRuntime } from "@/lib/schedule/workspace-engine";
import type { WorkspaceStructure } from "@/lib/schedule/types";

const structure: WorkspaceStructure = {
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
              ],
            },
          ],
        },
      ],
    },
  ],
};

describe("BlockSessionBadge", () => {
  it("renders template name and progress", () => {
    const rt = initRuntime(structure, "Upper A");
    render(<BlockSessionBadge structure={structure} runtime={rt} />);
    expect(screen.getByText("Upper A")).toBeDefined();
    expect(screen.getByText(/0\/2/)).toBeDefined();
  });

  it("renders nothing for empty template", () => {
    const empty: WorkspaceStructure = { levels: [], display: { summary: "", progress: "boolean" }, templates: [] };
    const { container } = render(<BlockSessionBadge structure={empty} runtime={{}} />);
    expect(container.firstChild).toBeNull();
  });
});

describe("SessionView", () => {
  it("renders preview state with all groups and exercises", () => {
    const rt = initRuntime(structure, "Upper A");
    render(<SessionView structure={structure} runtime={rt} onChange={() => {}} onClose={() => {}} />);
    expect(screen.getByText("Upper A")).toBeDefined();
    expect(screen.getByText("Chest")).toBeDefined();
    expect(screen.getByText("Bench Press")).toBeDefined();
    expect(screen.getByText("Start Session")).toBeDefined();
  });

  it("switches to active state on start", () => {
    const initialRt = initRuntime(structure, "Upper A");
    let currentRuntime = { ...initialRt };
    function Wrapper() {
      const [rt, setRt] = useState(currentRuntime);
      return (
        <SessionView
          structure={structure}
          runtime={rt}
          onChange={(r) => { currentRuntime = r; setRt({ ...r }); }}
          onClose={() => {}}
        />
      );
    }
    render(<Wrapper />);
    fireEvent.click(screen.getByText("Start Session"));
    expect(screen.getByText("Set to track")).toBeDefined();
    expect(screen.getByText("Complete")).toBeDefined();
  });

  it("shows completed state when all items done", () => {
    const tracking: Record<string, boolean> = {};
    for (const g of structure.templates[0].children ?? []) {
      for (const e of g.children ?? []) {
        for (const s of e.children ?? []) {
          tracking[`${g.name}/${e.name}/${s.name}`] = true;
        }
      }
    }
    const rt = { templateName: "Upper A", tracking, _sessionStarted: true };
    render(<SessionView structure={structure} runtime={rt} onChange={() => {}} onClose={() => {}} />);
    expect(screen.getByText("Session complete")).toBeDefined();
  });
});
