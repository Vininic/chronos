import type { ScheduleData } from "@/lib/schedule/types";
import type { ReportCard, DigestTimeframe } from "../types";
import { getBlocksForTimeframe } from "./helpers";
import { durationMin } from "@/lib/schedule/types";

export function burnoutAnalysis(data: ScheduleData, _timeframe: DigestTimeframe): ReportCard[] {
  const cards: ReportCard[] = [];
  const blocks = getBlocksForTimeframe(data, _timeframe);

  const nonSleep = blocks.filter((b: { kind: string }) => b.kind !== "sleep");
  const sorted = [...nonSleep].sort((a: { start: string }, b: { start: string }) => a.start.localeCompare(b.start));

  const hasSleepSchedule = data.meta.sleepSchedule && data.meta.sleepSchedule.length > 0;
  if (!hasSleepSchedule) {
    cards.push({
      kind: "burnout",
      severity: "insight",
      title: "No sleep schedule defined",
      body: "Without sleep windows, the schedule cannot distinguish rest periods from activity.",
      actionable: true,
    });
  }

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1] as { end: string };
    const curr = sorted[i] as { start: string };
    if (durationMin(prev.end, curr.start) < 0) {
      cards.push({
        kind: "burnout",
        severity: "warning",
        title: "Overlapping blocks detected",
        body: `Block at ${curr.start} starts before the previous block ends (${prev.end}). Overlapping blocks cannot both run as scheduled.`,
        actionable: true,
      });
      break;
    }
  }

  if (_timeframe === "monthly") {
    const snapshots = data.progressSnapshots;
    if (snapshots.length > 3) {
      const sorted_ = [...snapshots].sort((a: { date: string }, b: { date: string }) => a.date.localeCompare(b.date));
      const midIdx = Math.floor(sorted_.length / 2);
      const firstHalf = sorted_.slice(0, midIdx);
      const secondHalf = sorted_.slice(midIdx);
      const firstAvg = firstHalf.reduce((s: number, snap: { numerator: number; denominator: number }) => s + (snap.denominator > 0 ? snap.numerator / snap.denominator : 0), 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((s: number, snap: { numerator: number; denominator: number }) => s + (snap.denominator > 0 ? snap.numerator / snap.denominator : 0), 0) / secondHalf.length;
      if (secondAvg < firstAvg - 0.15) {
        cards.push({
          kind: "burnout",
          severity: "insight",
          title: "Completion rate declined over the month",
          body: `Average completion dropped from ${Math.round(firstAvg * 100)}% to ${Math.round(secondAvg * 100)}%.`,
        });
      }
    }
  }

  return cards;
}
