import { useState, useEffect } from "react";
import type { ScheduleData } from "@/lib/schedule/types";
import type { Digest } from "@/lib/digest/types";
import { getAllDigests, getLatestDigest } from "@/lib/digest/store";
import { generateDigest } from "@/lib/digest/generator";
import { DigestView } from "./DigestView";
import { Button } from "@/components/ui/button";
import { CalendarDays, RotateCcw, History } from "lucide-react";
import { loadSettingsSync } from "@/lib/ai/settings/store";

interface ReportsPanelProps {
  data: ScheduleData;
}

export function ReportsPanel({ data }: ReportsPanelProps) {
  const [currentDigest, setCurrentDigest] = useState<Digest | null>(getLatestDigest());
  const [allDigests, setAllDigests] = useState<Digest[]>(getAllDigests());
  const [showHistory, setShowHistory] = useState(false);

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

  const handleGenerate = () => {
    const digest = generateDigest(data);
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
          <div className="space-y-3">
            {allDigests.map((d) => (
              <button
                key={d.id}
                onClick={() => { setCurrentDigest(d); setShowHistory(false); }}
                className="w-full text-left border border-border rounded-lg p-2.5 hover:bg-secondary/5 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs font-medium text-primary">{d.date}</span>
                  <span className="text-[9px] text-muted-foreground/60">{d.timeframe}</span>
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

      {!isAuto && !currentDigest && (
        <Button onClick={handleGenerate} size="sm" className="w-full h-8 text-xs">
          <RotateCcw className="h-3 w-3 mr-1.5" />
          Generate Today's Digest
        </Button>
      )}

      {currentDigest ? (
        <DigestView digest={currentDigest} />
      ) : isAuto ? (
        <p className="text-xs text-muted-foreground text-center py-4">
          No digest generated yet. Auto-generation runs on schedule changes.
        </p>
      ) : null}

      {!isAuto && currentDigest && (
        <Button onClick={handleGenerate} variant="outline" size="sm" className="w-full h-7 text-[10px]">
          <RotateCcw className="h-3 w-3 mr-1" />
          Regenerate
        </Button>
      )}
    </div>
  );
}

const TIMEFRAME_LABELS: Record<string, string> = {
  daily: "Daily Digest",
  weekly: "Weekly Review",
  monthly: "Monthly Review",
  custom: "Custom Report",
};
