import type { ScheduleData } from "@/lib/schedule/types";
import type { DigestTimeframe } from "../types";

export function getBlocksForTimeframe(data: ScheduleData, timeframe: DigestTimeframe) {
  if (timeframe === "daily") {
    const today = new Date().getDay();
    const todayBlocks = data.routine.filter((b: { day: number }) => b.day === today);
    return todayBlocks.length > 0 ? todayBlocks : data.routine;
  }
  return data.routine;
}

export function dailyAvg<T extends { day: number }>(blocks: T[], tf: DigestTimeframe): number {
  if (tf === "daily") return blocks.length;
  const days = new Set(blocks.map((b) => b.day)).size;
  return blocks.length / Math.max(days, 1);
}
