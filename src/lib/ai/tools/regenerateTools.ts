import { globalToolRegistry } from "./registry";

export interface RegenerateDaysParams {
  days: number[];
  instructions: string;
}

// A global ref for storing pending regeneration requests.
// The Aetheris component reads this after tool execution and performs the async generation.
export const pendingRegeneration = {
  current: null as RegenerateDaysParams | null,
};

export function registerRegenerateTools(): void {
  globalToolRegistry.register<RegenerateDaysParams, string>({
    name: "regenerateDays",
    description: "Regenerate the schedule for specific days with new instructions",
    category: "optimization",
    permission: "write",
    validate: (p) => {
      if (!p.days || p.days.length === 0) return "days must be a non-empty array of day indices (0=Sun, 6=Sat)";
      if (!p.instructions) return "instructions are required — tell the AI what to change";
      return null;
    },
    execute: (p) => {
      pendingRegeneration.current = p;
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const labels = p.days.map((d) => dayNames[d] ?? `Day ${d}`).join(", ");
      return `Regeneration queued for: ${labels}. Instructions: "${p.instructions}". I'll apply the new plan after generation completes.`;
    },
  });
}
