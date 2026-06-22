import type { ReportCard } from "@/lib/digest/types";
import { AlertTriangle, Lightbulb, TrendingUp, Target, Info } from "lucide-react";

const SEVERITY_ICONS = {
  insight: Info,
  warning: AlertTriangle,
  opportunity: Lightbulb,
  trend: TrendingUp,
  recommendation: Target,
};

// Severity carries the only color that means something — accent the card by it,
// in the app's own palette (bronze for actionable, amber for caution, emerald
// for opportunity), so digests read as part of Chronos rather than a rainbow.
const SEVERITY_COLORS: Record<string, string> = {
  insight: "text-muted-foreground",
  warning: "text-amber-600 dark:text-amber-400",
  opportunity: "text-emerald-600 dark:text-emerald-500",
  trend: "text-secondary",
  recommendation: "text-secondary",
};

const ACCENT_BAR: Record<string, string> = {
  insight: "bg-border",
  warning: "bg-amber-500/50",
  opportunity: "bg-emerald-500/50",
  trend: "bg-secondary/50",
  recommendation: "bg-secondary/50",
};

export function ReportCardView({ card }: { card: ReportCard }) {
  const Icon = SEVERITY_ICONS[card.severity];
  return (
    <div className="chronos-card overflow-hidden rounded-lg border border-border/60">
      <div className={`h-0.5 ${ACCENT_BAR[card.severity] ?? "bg-border"}`} />
      <div className="p-3">
        <div className="flex items-start gap-2">
          <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${SEVERITY_COLORS[card.severity]}`} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-[0.18em] text-secondary">
                {card.kind.replace("-", " ")}
              </span>
              <span className={`text-[9px] uppercase tracking-wider ${SEVERITY_COLORS[card.severity]}`}>
                {card.severity}
              </span>
            </div>
            <p className="text-xs font-medium text-primary mt-0.5">{card.title}</p>
            <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{card.body}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
