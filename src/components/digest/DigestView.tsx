import type { Digest } from "@/lib/digest/types";
import { ReportCardView } from "./ReportCard";
import { CalendarDays, ListChecks, ArrowRight, Sparkles, Cpu } from "lucide-react";

const COLOR_HEADER: Record<string, string> = {
  blue: "text-blue-400 border-blue-400/20",
  purple: "text-purple-400 border-purple-400/20",
  amber: "text-amber-400 border-amber-400/20",
  teal: "text-teal-400 border-teal-400/20",
};

const COLOR_BADGE: Record<string, string> = {
  blue: "bg-blue-500/10 text-blue-400 border-blue-400/20",
  purple: "bg-purple-500/10 text-purple-400 border-purple-400/20",
  amber: "bg-amber-500/10 text-amber-400 border-amber-400/20",
  teal: "bg-teal-500/10 text-teal-400 border-teal-400/20",
};

const TIMEFRAME_LABELS: Record<string, string> = {
  daily: "Daily Digest",
  weekly: "Weekly Review",
  monthly: "Monthly Review",
  custom: "Custom Report",
};

export function DigestView({ digest, onSendToChat }: { digest: Digest; onSendToChat?: (prompt: string) => void }) {
  return (
    <div className="space-y-4">
      <div className={`border rounded-lg p-3 ${COLOR_HEADER[digest.color]}`}>
        <div className="flex items-center gap-2 mb-2">
          <CalendarDays className={`h-4 w-4 ${COLOR_HEADER[digest.color].split(" ")[0]}`} />
          <span className="text-xs font-medium text-primary">{TIMEFRAME_LABELS[digest.timeframe]}</span>
          <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${COLOR_BADGE[digest.color]}`}>
            {digest.date}
          </span>
          <span className={`ml-auto flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full border ${
            digest.generatedBy === "ai"
              ? "border-secondary/30 text-secondary bg-secondary/5"
              : "border-muted-foreground/20 text-muted-foreground/60"
          }`}>
            {digest.generatedBy === "ai" ? <Sparkles className="h-2.5 w-2.5" /> : <Cpu className="h-2.5 w-2.5" />}
            {digest.generatedBy === "ai" ? "AI" : "Structural"}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">{digest.summary}</p>
      </div>

      <div className="space-y-2">
        {digest.cards.map((card, i) => (
          <ReportCardView key={`${card.kind}-${i}`} card={card} color={digest.color} />
        ))}
      </div>

      {digest.recommendations.length > 0 && (
        <div className="border border-border rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <ListChecks className="h-4 w-4 text-secondary" />
            <span className="text-xs font-medium text-primary">Recommendations</span>
          </div>
          <ul className="space-y-1.5">
            {digest.recommendations.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-[11px] text-muted-foreground">
                <ArrowRight className="h-3 w-3 mt-0.5 shrink-0 text-secondary" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {digest.opportunities.length > 0 && (
        <div className="border border-border rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium text-primary">Action Opportunities</span>
            {onSendToChat && <span className="text-[9px] text-muted-foreground/50">click to ask Aetheris</span>}
          </div>
          <div className="flex flex-wrap gap-2">
            {digest.opportunities.map((op, i) => (
              <button
                key={i}
                onClick={() => onSendToChat?.(`Help me with: "${op.label}". Please suggest concrete changes to my schedule.`)}
                className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${
                  onSendToChat
                    ? "border-secondary/30 text-secondary hover:bg-secondary/10 hover:border-secondary/50"
                    : "border-border text-muted-foreground hover:bg-secondary/10 hover:text-primary"
                }`}
              >
                {op.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
