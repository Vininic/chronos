import type { ReportCard, DigestColor } from "@/lib/digest/types";
import { AlertTriangle, Lightbulb, TrendingUp, Target, Info } from "lucide-react";

const SEVERITY_ICONS = {
  insight: Info,
  warning: AlertTriangle,
  opportunity: Lightbulb,
  trend: TrendingUp,
  recommendation: Target,
};

const SEVERITY_COLORS: Record<string, string> = {
  insight: "text-muted-foreground",
  warning: "text-amber-500",
  opportunity: "text-emerald-500",
  trend: "text-blue-500",
  recommendation: "text-secondary",
};

const CARD_BORDER: Record<DigestColor, string> = {
  blue: "border-blue-400/30",
  purple: "border-purple-400/30",
  amber: "border-amber-400/30",
  teal: "border-teal-400/30",
};

const CARD_HEADER: Record<DigestColor, string> = {
  blue: "text-blue-400",
  purple: "text-purple-400",
  amber: "text-amber-400",
  teal: "text-teal-400",
};

const ACCENT_BAR: Record<DigestColor, string> = {
  blue: "bg-blue-500/40",
  purple: "bg-purple-500/40",
  amber: "bg-amber-500/40",
  teal: "bg-teal-500/40",
};

export function ReportCardView({ card, color }: { card: ReportCard; color: DigestColor }) {
  const Icon = SEVERITY_ICONS[card.severity];
  return (
    <div className={`border rounded-lg overflow-hidden ${CARD_BORDER[color]}`}>
      <div className={`h-0.5 ${ACCENT_BAR[color]}`} />
      <div className="p-3">
        <div className="flex items-start gap-2">
          <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${SEVERITY_COLORS[card.severity]}`} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] uppercase tracking-wider ${CARD_HEADER[color]}`}>
                {card.kind.replace("-", " ")}
              </span>
              <span className={`text-[9px] uppercase ${SEVERITY_COLORS[card.severity]}`}>
                {card.severity}
              </span>
            </div>
            <p className="text-xs font-medium text-primary mt-0.5">{card.title}</p>
            <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{card.body}</p>
            {card.detail && (
              <p className="text-[10px] text-muted-foreground/60 mt-1 italic">{card.detail}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
