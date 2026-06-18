import { useState, useEffect } from "react";
import type { ScheduleData } from "@/lib/schedule/types";
import type { Digest, DigestTimeframe } from "@/lib/digest/types";
import { getAllDigests, getLatestDigest } from "@/lib/digest/store";
import { generateDigest } from "@/lib/digest/generator";
import { DigestView } from "./DigestView";
import { Button } from "@/components/ui/button";
import { CalendarDays, RotateCcw, History } from "lucide-react";
import { loadSettingsSync } from "@/lib/ai/settings/store";

const TIMEFRAME_OPTIONS: { key: DigestTimeframe; label: string }[] = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
];

const TIMEFRAME_LABELS: Record<string, string> = {
  daily: "Daily Digest",
  weekly: "Weekly Review",
  monthly: "Monthly Review",
  custom: "Custom Report",
};

const HISTORY_BORDER: Record<string, string> = {
  blue: "border-l-blue-400/50",
  purple: "border-l-purple-400/50",
  amber: "border-l-amber-400/50",
  teal: "border-l-teal-400/50",
};

const HISTORY_DOT: Record<string, string> = {
  blue: "bg-blue-400",
  purple: "bg-purple-400",
  amber: "bg-amber-400",
  teal: "bg-teal-400",
};

interface ReportsPanelProps {
  data: ScheduleData;
}

export function ReportsPanel({ data }: ReportsPanelProps) {
  const [currentDigest, setCurrentDigest] = useState<Digest | null>(getLatestDigest());
  const [allDigests, setAllDigests] = useState<Digest[]>(getAllDigests());
  const [showHistory, setShowHistory] = useState(false);
  const [generateTf, setGenerateTf] = useState<DigestTimeframe>("daily");

  const settings = loadSettingsSync();
  const isAuto = settings.featureToggles.digestAuto;

  useEffect(() => {
    if (isAuto) {
      const existing = getLatestDigest();
      if (!existing || existing.date !== new Date().toISOString().slice(0, 10)) {
        const digest = generateDigest(data);
        setCurrentDigest(digest);
        setAllDigests(getAllDigests());
      } else {
        setCurrentDigest(existing);
      }
    }
  }, [isAuto, data.meta.version, data.routine.length, data.commitments.length]);

  const handleGenerate = (tf?: DigestTimeframe) => {
    const digest = generateDigest(data, tf ?? generateTf);
    setCurrentDigest(digest);
    setAllDigests(getAllDigests());
  };

  if (showHistory) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Digest History</span>
          <button
            onClick={() => setShowHistory(false)}
            className="text-[10px] text-secondary hover:text-secondary/80 transition-colors"
          >
            Back
          </button>
        </div>
        {allDigests.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">No digests yet.</p>
        ) : (
          <div className="space-y-2">
            {allDigests.map((d) => (
              <button
                key={d.id}
                onClick={() => { setCurrentDigest(d); setShowHistory(false); }}
                className={`w-full text-left border border-border rounded-lg p-2.5 hover:bg-secondary/5 transition-colors border-l-2 ${HISTORY_BORDER[d.color]}`}
              >
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full shrink-0 ${HISTORY_DOT[d.color]}`} />
                  <span className="text-xs font-medium text-primary">{d.date}</span>
                  <span className="text-[9px] text-muted-foreground/60">{TIMEFRAME_LABELS[d.timeframe] ?? d.timeframe}</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1 line-clamp-1">{d.summary}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
          {currentDigest ? TIMEFRAME_LABELS[currentDigest.timeframe] : "Reports"}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowHistory(true)}
            className="h-6 px-1.5 text-[9px] text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
          >
            <History className="h-3 w-3" />
            History
          </button>
        </div>
      </div>

      {(isAuto || currentDigest) && (
        <div className="flex gap-1">
          {TIMEFRAME_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => handleGenerate(opt.key)}
              className={`flex-1 text-[9px] py-1.5 rounded-md border transition-colors ${
                generateTf === opt.key
                  ? "border-secondary/40 bg-secondary/10 text-secondary font-medium"
                  : "border-border text-muted-foreground hover:text-primary hover:bg-secondary/5"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {currentDigest ? (
        <DigestView digest={currentDigest} />
      ) : isAuto ? (
        <p className="text-xs text-muted-foreground text-center py-4">
          No digest generated yet. Auto-generation runs on schedule changes.
        </p>
      ) : (
        <Button onClick={() => handleGenerate()} size="sm" className="w-full h-8 text-xs">
          <RotateCcw className="h-3 w-3 mr-1.5" />
          Generate
        </Button>
      )}
    </div>
  );
}
