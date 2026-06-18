import type { ScheduleData } from "@/lib/schedule/types";
import type { ReportCard, DigestTimeframe } from "../types";
import { getBlocksForTimeframe } from "./helpers";

export function productivityAnalysis(data: ScheduleData, timeframe: DigestTimeframe): ReportCard[] {
  const cards: ReportCard[] = [];
  const allBlocks = getBlocksForTimeframe(data, timeframe).filter((b: { kind: string }) => b.kind !== "sleep");

  const morning = allBlocks.filter((b: { start: string }) => { const h = parseInt(b.start.split(":")[0], 10); return h >= 5 && h < 12; });
  const afternoon = allBlocks.filter((b: { start: string }) => { const h = parseInt(b.start.split(":")[0], 10); return h >= 12 && h < 18; });
  const evening = allBlocks.filter((b: { start: string }) => { const h = parseInt(b.start.split(":")[0], 10); return h >= 18; });

  if (timeframe === "weekly") {
    const byDay = new Map<number, number>();
    for (const b of allBlocks as Array<{ day: number; kind: string }>) {
      if (b.kind === "deep") byDay.set(b.day, (byDay.get(b.day) ?? 0) + 1);
    }
    const daysWithDeep = byDay.size;
    if (daysWithDeep > 0 && daysWithDeep < 4) {
      cards.push({
        kind: "productivity",
        severity: "insight",
        title: `Deep work on ${daysWithDeep} day${daysWithDeep > 1 ? "s" : ""} this week`,
        body: `Deep work sessions are scheduled on ${daysWithDeep} day${daysWithDeep > 1 ? "s" : ""} of the week.`,
      });
    }
    const totalMorning = morning.length;
    const totalAfternoon = afternoon.length;
    const totalEvening = evening.length;
    if (totalMorning > totalEvening + totalAfternoon) {
      cards.push({
        kind: "productivity",
        severity: "insight",
        title: "Most blocks are in the morning this week",
        body: `${totalMorning} blocks before noon, ${totalAfternoon} in the afternoon, ${totalEvening} in the evening.`,
      });
    } else if (totalEvening > totalMorning + totalAfternoon) {
      cards.push({
        kind: "productivity",
        severity: "insight",
        title: "Most blocks are in the evening this week",
        body: `${totalEvening} blocks after 6 PM, ${totalMorning} in the morning, ${totalAfternoon} in the afternoon.`,
      });
    }
  } else if (timeframe === "monthly") {
    const deepAll = allBlocks.filter((b: { kind: string }) => b.kind === "deep");
    const scheduledHours = data.ledger.scheduledHours;
    if (scheduledHours.length > 0) {
      const avg = scheduledHours.reduce((s: number, v: number) => s + v, 0) / scheduledHours.length;
      cards.push({
        kind: "productivity",
        severity: "insight",
        title: `Averaging ${Math.round(avg)} scheduled hours per day`,
        body: `Across ${scheduledHours.length} tracked day${scheduledHours.length > 1 ? "s" : ""} this month.`,
      });
    }
    if (deepAll.length > 0) {
      cards.push({
        kind: "productivity",
        severity: "insight",
        title: `${deepAll.length} deep work sessions this month`,
        body: deepAll.length > 10 ? "Consistent deep work is scheduled throughout the month." : "Deep work sessions appear in the current schedule.",
      });
    }
  } else {
    const total = allBlocks.length;
    cards.push({
      kind: "productivity",
      severity: "insight",
      title: `${total} block${total > 1 ? "s" : ""} scheduled today`,
      body: `${morning.length} in the morning, ${afternoon.length} in the afternoon, ${evening.length} in the evening.`,
    });
  }

  return cards;
}
