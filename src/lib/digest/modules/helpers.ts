import type { ScheduleData } from "@/lib/schedule/types";
import type { DigestTimeframe } from "../types";

export function getBlocksForTimeframe(data: ScheduleData, timeframe: DigestTimeframe) {
  if (timeframe === "daily") {
    const today = new Date().getDay();
    return data.routine.filter((b: { day: number }) => b.day === today);
  }
  return data.routine;
}
