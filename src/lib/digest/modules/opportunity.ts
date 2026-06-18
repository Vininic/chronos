import type { ScheduleData } from "@/lib/schedule/types";
import type { ReportCard, DigestTimeframe } from "../types";
import { getBlocksForTimeframe } from "./helpers";

export function opportunityAnalysis(data: ScheduleData, timeframe: DigestTimeframe): ReportCard[] {
  const cards: ReportCard[] = [];

  const blocks = getBlocksForTimeframe(data, timeframe)
    .filter((b: { kind: string }) => b.kind !== "sleep")
    .sort((a: { start: string }, b: { start: string }) => a.start.localeCompare(b.start));

  const deepBlocks = blocks.filter((b: { kind: string }) => b.kind === "deep");
  if (deepBlocks.length > 0) {
    const deepMornings = deepBlocks.filter((b: { start: string }) => {
      const h = parseInt(b.start.split(":")[0], 10);
      return h < 12;
    });
    cards.push({
      kind: "opportunity",
      severity: "insight",
      title: `${deepMornings.length} of ${deepBlocks.length} deep work session${deepBlocks.length > 1 ? "s" : ""} in the morning`,
      body: `${Math.round((deepMornings.length / deepBlocks.length) * 100)}% of deep work is scheduled before noon.`,
    });
  }

  const shallowOrMeeting = blocks.filter((b: { kind: string }) => b.kind === "shallow" || b.kind === "meeting");
  if (shallowOrMeeting.length > 0) {
    cards.push({
      kind: "opportunity",
      severity: "insight",
      title: `${shallowOrMeeting.length} shallow or meeting block${shallowOrMeeting.length > 1 ? "s" : ""}`,
      body: timeframe === "weekly"
        ? `Across the week, ${shallowOrMeeting.length} block${shallowOrMeeting.length > 1 ? "s are" : " is"} typed as shallow or meeting.`
        : `${shallowOrMeeting.length} block${shallowOrMeeting.length > 1 ? "s" : ""} typed as shallow or meeting in the current view.`,
    });
  }

  if (timeframe === "monthly") {
    const scheduledHours = data.ledger.scheduledHours;
    if (scheduledHours.length > 1) {
      const variance = scheduledHours.reduce((max: number, h: number) => Math.max(max, h), 0) - scheduledHours.reduce((min: number, h: number) => Math.min(min, h), 0);
      cards.push({
        kind: "opportunity",
        severity: "insight",
        title: `Daily hours vary by ${Math.round(variance)}h across the month`,
        body: `From ${Math.round(Math.min(...scheduledHours))}h to ${Math.round(Math.max(...scheduledHours))}h per day.`,
      });
    }
    const goalsWithDeadlines = data.goals.filter((g: { kind: string; deadline?: string }) => g.kind === "deadline" && g.deadline);
    const thisMonth = goalsWithDeadlines.filter((g: { deadline: string }) => g.deadline!.startsWith(new Date().toISOString().slice(0, 7)));
    if (thisMonth.length > 0) {
      cards.push({
        kind: "opportunity",
        severity: "insight",
        title: `${thisMonth.length} deadline${thisMonth.length > 1 ? "s" : ""} due this month`,
        body: thisMonth.map((g: { title: string; deadline: string }) => `"${g.title}" (${g.deadline})`).join(", "),
      });
    }
  }

  return cards;
}
