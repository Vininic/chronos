import { useState, useEffect, useCallback } from "react";
import type { ScheduleData } from "@/lib/schedule/types";
import type { Digest, DigestTimeframe } from "@/lib/digest/types";
import { getAllDigests, getLatestDigest } from "@/lib/digest/store";
import { generateDigest } from "@/lib/digest/generator";
import { DigestView } from "./DigestView";
import { Button } from "@/components/ui/button";
import { CalendarDays, RotateCcw, History, CalendarRange, Sparkles } from "lucide-react";
import { loadSettingsSync } from "@/lib/ai/settings/store";

const TIMEFRAME_OPTIONS: { key: DigestTimeframe; label: string }[] = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "custom", label: "Custom" },
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
  const latestDaily = getAllDigests().find((d) => d.timeframe === "daily") ?? getLatestDigest();
  const [currentDigest, setCurrentDigest] = useState<Digest | null>(latestDaily);
  const [allDigests, setAllDigests] = useState<Digest[]>(getAllDigests());
  const [showHistory, setShowHistory] = useState(false);
  const [generateTf, setGenerateTf] = useState<DigestTimeframe>(latestDaily?.timeframe ?? "daily");
  const [generating, setGenerating] = useState(false);
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().slice(0, 10);
  });
  const [customEnd, setCustomEnd] = useState(() => new Date().toISOString().slice(0, 10));

  const settings = loadSettingsSync();
  const isAuto = settings.featureToggles.digestAuto;
  const useAI = settings.featureToggles.aiReports;

  useEffect(() => {
    if (currentDigest) setGenerateTf(currentDigest.timeframe);
  }, [currentDigest?.id]);

  const tryGenerate = useCallback(async (tf?: DigestTimeframe) => {
    if (generating) return;
    setGenerating(true);
    try {
      const finalTf = tf ?? generateTf;
      const isCustom = finalTf === "custom";
      const digest = await generateDigest(data, finalTf, isCustom ? { start: customStart, end: customEnd } : undefined);
      setCurrentDigest(digest);
      setAllDigests(getAllDigests());
    } finally {
      setGenerating(false);
    }
  }, [data, generateTf, customStart, customEnd, generating]);

  useEffect(() => {
    if (isAuto) {
      const existing = getLatestDigest();
      if (!existing || existing.date !== new Date().toISOString().slice(0, 10)) {
        tryGenerate("daily");
      }
    }
  }, [isAuto, data.meta.version, data.routine.length, data.commitments.length]);

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
                  <span className="text-xs font-medium text-primary">{d.date.length > 12 ? d.date.slice(0, 10) : d.date}</span>
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
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
            {currentDigest ? TIMEFRAME_LABELS[currentDigest.timeframe] : "Reports"}
          </span>
          {useAI && <Sparkles className="h-3 w-3 text-secondary" />}
        </div>
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

      <div className="flex gap-1">
        {TIMEFRAME_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            onClick={() => {
              setGenerateTf(opt.key);
              if (opt.key !== "custom") tryGenerate(opt.key);
            }}
            disabled={generating}
            className={`flex-1 text-[9px] py-1.5 rounded-md border transition-colors ${
              generateTf === opt.key
                ? "border-secondary/40 bg-secondary/10 text-secondary font-medium"
                : "border-border text-muted-foreground hover:text-primary hover:bg-secondary/5"
            } disabled:opacity-50`}
          >
            {opt.key === "custom" ? <CalendarRange className="h-3 w-3 inline mr-0.5" /> : null}
            {opt.label}
          </button>
        ))}
      </div>

      {generateTf === "custom" && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            className="flex-1 h-7 text-[10px] bg-transparent border border-border rounded px-1.5 text-primary"
          />
          <span className="text-[9px] text-muted-foreground">to</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="flex-1 h-7 text-[10px] bg-transparent border border-border rounded px-1.5 text-primary"
          />
          <Button onClick={() => tryGenerate("custom")} disabled={generating} size="sm" className="h-7 text-[9px] px-2">
            {generating ? "..." : "Go"}
          </Button>
        </div>
      )}

      {generating ? (
        <p className="text-xs text-muted-foreground text-center py-4">Generating{useAI ? " with AI" : ""}...</p>
      ) : currentDigest ? (
        <DigestView digest={currentDigest} />
      ) : (
        <Button onClick={() => tryGenerate()} disabled={generating} size="sm" className="w-full h-8 text-xs">
          {generating ? "..." : <><RotateCcw className="h-3 w-3 mr-1.5" /> Generate</>}
        </Button>
      )}
    </div>
  );
}
