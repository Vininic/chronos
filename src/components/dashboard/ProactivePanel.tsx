import { useState, useEffect, useRef, useMemo } from "react";
import { Bell, Clock, CalendarDays, Sparkles } from "lucide-react";
import type { Insight, RecoveryAnalysis } from "@/lib/ai/core/schemas";
import type { OptimizationResult } from "@/lib/ai/optimization/optimizationEngine";
import type { ScheduleData } from "@/lib/schedule/types";
import { timeToMinutes, durationMin, fmtDur } from "@/lib/schedule/types";
import { getLatestBriefing } from "@/lib/ai/briefing/generate";
import { useNavigate } from "react-router-dom";

interface ProactivePanelProps {
  insights: Insight[];
  optimization: OptimizationResult;
  recoveryIntel: RecoveryAnalysis;
  data: ScheduleData;
}

type ProactiveItem = {
  id: string;
  type: "reminder" | "digest" | "insight";
  title: string;
  description: string;
  timestamp: number;
  icon: typeof Bell;
};

function getNextBlock(data: ScheduleData): { title: string; start: string; end: string; kind: string; day: number } | null {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const todayBlocks = data.routine
    .filter((b) => b.day === dayOfWeek)
    .map((b) => ({ title: b.title || b.kind, start: b.start, end: b.end, kind: b.kind, day: b.day }))
    .sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
  return todayBlocks.find((b) => timeToMinutes(b.start) > nowMin + 5) ?? null;
}

export function getProactiveCount(data: ScheduleData, insights: Insight[], _recoveryIntel: RecoveryAnalysis, optimization?: OptimizationResult): number {
  let c = 1; // digest always shown
  if (getNextBlock(data)) c++;
  if (optimization && optimization.conflicts.length > 0) c++;
  const nonRecovery = insights.filter((i) => !i.type || !["overload", "burnout_risk", "sleep_debt", "context_switching", "consecutive_work"].includes(i.type));
  c += Math.min(nonRecovery.length, 2);
  return c;
}

export function buildDigest(data: ScheduleData): string {
  const ai = getLatestBriefing();
  if (ai) return ai;

  const now = new Date();
  const dayOfWeek = now.getDay();
  const todayBlocks = data.routine.filter((b) => b.day === dayOfWeek).sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
  const todayCommitments = data.commitments.filter((c) => {
    if (!c.date) return false;
    const cDate = new Date(c.date + "T00:00:00");
    return cDate.toDateString() === now.toDateString();
  });
  const totalMin = todayBlocks.reduce((s, b) => s + durationMin(b.start, b.end), 0);
  const totalCmtMin = todayCommitments.reduce((s, c) => s + durationMin(c.start, c.end), 0);
  const blockCount = todayBlocks.length;
  const cmtCount = todayCommitments.length;

  // Detect back-to-back clusters
  let clusters = 0;
  for (let i = 1; i < todayBlocks.length; i++) {
    const gap = timeToMinutes(todayBlocks[i].start) - timeToMinutes(todayBlocks[i - 1].end);
    if (gap <= 15) clusters++;
  }

  // Detect large gaps (>90m)
  const gaps: string[] = [];
  for (let i = 1; i < todayBlocks.length; i++) {
    const gapMin = timeToMinutes(todayBlocks[i].start) - timeToMinutes(todayBlocks[i - 1].end);
    if (gapMin >= 90) gaps.push(fmtDur(gapMin));
  }

  const parts: string[] = [];
  if (blockCount > 0 || cmtCount > 0) {
    parts.push(`${blockCount} blocks (${fmtDur(totalMin)})${cmtCount > 0 ? ` + ${cmtCount} tasks (${fmtDur(totalCmtMin)})` : ""}`);
  }
  if (clusters > 1) parts.push(`${clusters} tight clusters`);
  if (gaps.length > 0) parts.push(`${gaps.length} large gap${gaps.length > 1 ? "s" : ""} (${gaps.join(", ")})`);
  if (blockCount === 0 && cmtCount === 0) parts.push("No blocks scheduled");
  return parts.join(" · ");
}

export default function ProactivePanel({ insights, optimization, recoveryIntel, data }: ProactivePanelProps) {
  const [lastActive, setLastActive] = useState(Date.now());
  const [isIdle, setIsIdle] = useState(false);
  const [dismissedItems, setDismissedItems] = useState<Set<string>>(new Set());
  const idleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigate = useNavigate();

  const IDLE_THRESHOLD = 30_000;

  useEffect(() => {
    const handleActivity = () => {
      setLastActive(Date.now());
      setIsIdle(false);
      if (activityTimerRef.current) clearTimeout(activityTimerRef.current);
    };
    window.addEventListener("mousemove", handleActivity, { passive: true });
    window.addEventListener("keydown", handleActivity, { passive: true });
    window.addEventListener("scroll", handleActivity, { passive: true });
    window.addEventListener("click", handleActivity, { passive: true });
    return () => {
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("scroll", handleActivity);
      window.removeEventListener("click", handleActivity);
      if (idleTimerRef.current) clearInterval(idleTimerRef.current);
    };
  }, []);

  useEffect(() => {
    idleTimerRef.current = setInterval(() => {
      if (Date.now() - lastActive > IDLE_THRESHOLD) {
        setIsIdle(true);
      }
    }, 5_000);
    return () => {
      if (idleTimerRef.current) clearInterval(idleTimerRef.current);
    };
  }, [lastActive]);

  const items = useMemo(() => {
    const result: ProactiveItem[] = [];

    // End-of-day digest (AI-driven when briefing available)
    const digestText = buildDigest(data);
    if (digestText) {
      result.push({
        id: "digest",
        type: "digest",
        title: "Today's digest",
        description: digestText,
        timestamp: Date.now(),
        icon: CalendarDays,
      });
    }

    const nextBlock = getNextBlock(data);
    if (nextBlock) {
      result.push({
        id: "upcoming",
        type: "reminder",
        title: "Upcoming block",
        description: `${nextBlock.title} at ${nextBlock.start}`,
        timestamp: Date.now(),
        icon: Clock,
      });
    }

    // Optimization conflicts as proactive cards
    if (optimization.conflicts.length > 0) {
      result.push({
        id: "conflicts",
        type: "insight",
        title: `Conflicts (${optimization.conflicts.length})`,
        description: `${optimization.conflicts.length} scheduling conflict${optimization.conflicts.length === 1 ? "" : "s"} found. Open Optimize tab for details.`,
        timestamp: Date.now(),
        icon: Bell,
      });
    }

    // Non-recovery insights from pipeline
    if (insights.length > 0) {
      for (const ins of insights.slice(0, 2)) {
        const isRecovery = ins.type && ["overload", "burnout_risk", "sleep_debt", "context_switching", "consecutive_work"].includes(ins.type);
        if (isRecovery) continue;
        result.push({
          id: "insight-" + ins.title,
          type: "insight",
          title: ins.title,
          description: ins.detail,
          timestamp: Date.now(),
          icon: Sparkles,
        });
      }
    }

    return result;
  }, [data, optimization, insights]);

  const visibleItems = items.filter((i) => !dismissedItems.has(i.id));
  const unreadCount = visibleItems.length;

  const dismiss = (id: string) => {
    setDismissedItems((prev) => new Set(prev).add(id));
  };

  return (
    <div className="space-y-3">
      {isIdle && visibleItems.length > 0 && (
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground/60 pb-1 border-b border-border/30">
          While you were away
        </div>
      )}
      {!isIdle && visibleItems.length > 0 && (
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground/60 pb-1 border-b border-border/30">
          Proactive ({unreadCount})
        </div>
      )}
      {visibleItems.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-4">No proactive items yet</p>
      )}
      {visibleItems.map((item) => (
        <div key={item.id} className="border border-border rounded-lg p-3 transition-opacity hover:opacity-80">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <item.icon className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="text-xs font-medium text-primary truncate">{item.title}</span>
            </div>
            <button
              onClick={() => dismiss(item.id)}
              className="text-[10px] text-muted-foreground/40 hover:text-muted-foreground shrink-0 leading-none"
            >
              ✕
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{item.description}</p>
        </div>
      ))}
    </div>
  );
}
