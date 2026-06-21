import type { Commitment, RoutineBlock, ScheduleData } from "../types";
import { timeToMinutes } from "../types";
import { buildRoutineWeeklySegments, commitmentInterval, intervalsOverlap } from "../helpers";
import { validateRoutineSleepOverlap as sleepValidateRoutine, validateCommitmentSleepOverlap as sleepValidateCommitment } from "../sleep";

export function checkRoutineConflict(data: ScheduleData, candidate: Pick<RoutineBlock, "day" | "start" | "end" | "endsNextDay">, excludeId?: string): string | null {
  const sleepErr = sleepValidateRoutine(data, candidate);
  if (sleepErr) return sleepErr;

  const candidateSegments = buildRoutineWeeklySegments(candidate);
  const conflict = data.routine.find((r) => {
    if (r.id === excludeId) return false;
    const existingSegments = buildRoutineWeeklySegments(r);
    return candidateSegments.some((candidateSegment) =>
      existingSegments.some((existingSegment) =>
        candidateSegment.day === existingSegment.day
        && candidateSegment.startMin < existingSegment.endMin
        && existingSegment.startMin < candidateSegment.endMin,
      ),
    );
  });
  if (conflict) {
    return `Conflicts with "${conflict.title}" (${conflict.start}-${conflict.end}).`;
  }
  return null;
}

export function checkCommitmentConflict(data: ScheduleData, candidate: Pick<Commitment, "date" | "start" | "end" | "endDate" | "endsNextDay">, excludeId?: string): string | null {
  if (!candidate.date) return null;
  const sleepErr = sleepValidateCommitment(data, candidate);
  if (sleepErr) return sleepErr;

  const nextInterval = commitmentInterval(candidate);
  const conflict = data.commitments.find((c) => {
    if (c.id === excludeId) return false;
    return intervalsOverlap(commitmentInterval(c), nextInterval);
  });
  if (conflict) {
    return `Conflicts with "${conflict.title}" (${conflict.start}-${conflict.end}).`;
  }
  return null;
}

export function buildCandidateRoutine(b: Omit<RoutineBlock, "id">): RoutineBlock {
  return {
    ...b,
    endsNextDay: b.endsNextDay ?? b.end <= b.start,
  } as RoutineBlock;
}

export function buildCandidateCommitment(c: Omit<Commitment, "id">): Omit<Commitment, "id"> {
  return {
    ...c,
    endsNextDay: c.endsNextDay ?? c.end <= c.start,
  };
}
