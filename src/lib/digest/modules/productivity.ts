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
        title: `Deep work spans ${daysWithDeep} day${daysWithDeep > 1 ? "s" : ""} this week`,
        body: `Deep work sessions are concentrated on ${daysWithDeep} day${daysWithDeep > 1 ? "s" : ""}. Spreading them more evenly could improve weekly output consistency.`,
      });
    }
    const totalMorning = morning.length;
    const totalAfternoon = afternoon.length;
    const totalEvening = evening.length;
    if (totalMorning > totalEvening + totalAfternoon) {
      cards.push({
        kind: "productivity",
        severity: "trend",
        title: "Mornings are the most productive this week",
        body: `${totalMorning} blocks are scheduled before noon this week — mornings dominate your schedule.`,
      });
    }
  } else if (timeframe === "monthly") {
    const deepAll = allBlocks.filter((b: { kind: string }) => b.kind === "deep");
    const scheduledHours = data.ledger.scheduledHours;
    if (scheduledHours.length > 0) {
      const avg = scheduledHours.reduce((s: number, v: number) => s + v, 0) / scheduledHours.length;
      cards.push({
        kind: "productivity",
        severity: avg > 8 ? "warning" : "trend",
        title: avg > 8 ? "Monthly workload above recommended ceiling" : "Monthly workload is within healthy range",
        body: avg > 8
          ? `Average ${Math.round(avg)} hours scheduled per day this month exceeds the 8-hour productive ceiling.`
          : `Average ${Math.round(avg)} hours per day this month — sustainable for long-term productivity.`,
      });
    }
    if (deepAll.length > 10) {
      cards.push({
        kind: "productivity",
        severity: "trend",
        title: "Strong deep work volume this month",
        body: `${deepAll.length} deep work sessions scheduled across the month. Consistent deep work is a strong productivity driver.`,
      });
    }
  } else {
    if (morning.length > afternoon.length && morning.length > evening.length) {
      cards.push({
        kind: "productivity",
        severity: "insight",
        title: "Most blocks are in the morning",
        body: `${morning.length} blocks are scheduled before noon. Morning-oriented schedules typically have higher completion rates.`,
      });
    } else if (evening.length > morning.length) {
      cards.push({
        kind: "productivity",
        severity: "trend",
        title: "Most blocks are in the evening",
        body: `${evening.length} blocks are scheduled after 6 PM. Evening hours often have lower completion rates.`,
      });
    }
  }

  const deepBlocks = allBlocks.filter((b: { kind: string }) => b.kind === "deep");
  if (deepBlocks.length > 0) {
    const deepAfterNoon = deepBlocks.filter((b: { start: string }) => {
      const h = parseInt(b.start.split(":")[0], 10);
      return h >= 12;
    });
    if (deepAfterNoon.length > 0) {
      cards.push({
        kind: "productivity",
        severity: "opportunity",
        title: "Deep work placed in suboptimal hours",
        body: `${deepAfterNoon.length} deep work session${deepAfterNoon.length > 1 ? "s are" : " is"} scheduled after noon. Deep concentration typically peaks in late morning.`,
        actionable: true,
      });
    }
  }

  return cards;
}
