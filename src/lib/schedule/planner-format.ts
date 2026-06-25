import { useEffect, useState } from "react";
import { SNAP, timeToMinutes, snapTime, durationMin } from "./types";
import type { AgendaItem } from "./agenda";

export const HOUR_PX = 64;
export const STACK_GAP_PX = 4;

export type FreeSlot = { type: "free"; id: string; start: string; end: string };

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function toIsoDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isSameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

export function formatHourLabel(hour24: number, bcp47: string) {
  const d = new Date();
  d.setHours(hour24, 0, 0, 0);
  return d.toLocaleTimeString(bcp47, { hour: "2-digit", minute: "2-digit" });
}

export function formatClock(time: string, bcp47: string) {
  const [h, m] = time.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString(bcp47, { hour: "numeric", minute: "2-digit" });
}

export function fmtFriendlyDuration(totalMin: number, isPt: boolean) {
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;
  if (hours > 0 && minutes > 0) return isPt ? `${hours}h ${minutes}min` : `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  return isPt ? `${minutes}min` : `${minutes}m`;
}

export function isBoundarySleepBlock(a: AgendaItem) {
  return a.kind === "sleep" && Boolean((a as AgendaItem & { sleepBoundary?: boolean }).sleepBoundary);
}

export function useNowMin() {
  const [n, setN] = useState(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  });

  useEffect(() => {
    const id = window.setInterval(() => {
      const d = new Date();
      setN(d.getHours() * 60 + d.getMinutes());
    }, 30_000);
    return () => window.clearInterval(id);
  }, []);

  return n;
}

export function topFor(t: string, startMin: number) {
  return ((timeToMinutes(t) - startMin) / 60) * HOUR_PX;
}

export function blockHeight(s: string, e: string) {
  return Math.max(20, ((timeToMinutes(e) - timeToMinutes(s)) / 60) * HOUR_PX - 4);
}

export function freeHeight(s: string, e: string) {
  return Math.max(8, ((timeToMinutes(e) - timeToMinutes(s)) / 60) * HOUR_PX - 2);
}

export function buildTimeline(agenda: AgendaItem[], dayStart: number, dayEnd: number): (AgendaItem | FreeSlot)[] {
  const sorted = [...agenda].sort((a, b) => a.start.localeCompare(b.start));
  const result: (AgendaItem | FreeSlot)[] = [];
  let cursor = dayStart;

  for (const block of sorted) {
    const bs = timeToMinutes(block.start);
    const be = timeToMinutes(block.end);
    if (be <= dayStart || bs >= dayEnd) continue;

    const clippedStart = Math.max(dayStart, bs);
    const clippedEnd = Math.min(dayEnd, be);

    if (clippedStart - cursor >= SNAP) {
      result.push({ type: "free", id: `free-${cursor}`, start: snapTime(cursor), end: snapTime(clippedStart) });
    }

    result.push({ ...block, start: snapTime(clippedStart), end: snapTime(clippedEnd) });
    cursor = Math.max(cursor, clippedEnd);
  }

  if (dayEnd - cursor >= SNAP) {
    result.push({ type: "free", id: `free-${cursor}`, start: snapTime(cursor), end: snapTime(dayEnd) });
  }
  return result;
}
