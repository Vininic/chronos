import * as XLSX from "xlsx";
import type { ScheduleData } from "./types";
import { DAY_LABELS_LONG, durationMin, fmtDur } from "./types";

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportToXLSX(data: ScheduleData, filename = "chronos-schedule.xlsx") {
  const wb = XLSX.utils.book_new();

  // Weekly Routine
  const routineRows = [...data.routine]
    .sort((a, b) => a.day - b.day || a.start.localeCompare(b.start))
    .map((r) => ({
      Day: DAY_LABELS_LONG[r.day],
      Start: r.start,
      End: r.end,
      Duration: fmtDur(durationMin(r.start, r.end)),
      Category: r.kind,
      Title: r.title,
      Notes: r.notes ?? "",
    }));
  const wsRoutine = XLSX.utils.json_to_sheet(routineRows);
  wsRoutine["!cols"] = [{ wch: 12 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 40 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, wsRoutine, "Weekly Routine");

  // Commitments
  const commitRows = [...data.commitments]
    .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start))
    .map((c) => ({
      Date: c.date,
      Start: c.start,
      End: c.end,
      Duration: fmtDur(durationMin(c.start, c.end)),
      Category: c.kind,
      Title: c.title,
      Notes: c.notes ?? "",
    }));
  const wsCommit = XLSX.utils.json_to_sheet(commitRows.length ? commitRows : [{ Date: "", Start: "", End: "", Duration: "", Category: "", Title: "", Notes: "" }]);
  wsCommit["!cols"] = [{ wch: 12 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 40 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, wsCommit, "Commitments");

  // Focus blocks (deep work only)
  const focusRows = data.routine
    .filter((r) => r.kind === "deep")
    .map((r) => ({
      Day: DAY_LABELS_LONG[r.day],
      Start: r.start,
      End: r.end,
      Duration: fmtDur(durationMin(r.start, r.end)),
      Title: r.title,
    }));
  const wsFocus = XLSX.utils.json_to_sheet(focusRows.length ? focusRows : [{ Day: "", Start: "", End: "", Duration: "", Title: "" }]);
  wsFocus["!cols"] = [{ wch: 12 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, wsFocus, "Focus Blocks");

  // Categories / metadata
  const catRows = data.categories.map((c) => ({ ID: c.id, Label: c.label, Description: c.description }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(catRows), "Categories");

  const metaRows = [
    { Key: "Owner", Value: data.meta.owner },
    { Key: "Cycle", Value: `${data.meta.cycle.name} #${data.meta.cycle.number}` },
    { Key: "Week", Value: data.meta.cycle.week },
    { Key: "Workday", Value: `${data.meta.workdayStart}–${data.meta.workdayEnd}` },
    { Key: "Composition score", Value: data.ledger.compositionScore },
    { Key: "Exported", Value: new Date().toISOString() },
  ];
  const wsMeta = XLSX.utils.json_to_sheet(metaRows);
  wsMeta["!cols"] = [{ wch: 22 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, wsMeta, "Metadata");

  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  download(new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), filename);
}

/* ICS export — recurring routine (RRULE) + one-time commitments. */
function pad(n: number) { return String(n).padStart(2, "0"); }
function fmtICSDate(d: Date) {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
}
function nextWeekdayOnOrAfter(base: Date, weekday: number) {
  const d = new Date(base);
  const diff = (weekday - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff);
  return d;
}
function localDateTime(date: Date, time: string): Date {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(date);
  d.setHours(h, m, 0, 0);
  return d;
}
const BYDAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

export function exportToICS(data: ScheduleData, filename = "chronos-schedule.ics") {
  const now = new Date();
  const stamp = fmtICSDate(now);
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Chronos//Olympus Suite//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Chronos Schedule",
  ];

  for (const r of data.routine) {
    const firstDate = nextWeekdayOnOrAfter(now, r.day);
    const dtStart = localDateTime(firstDate, r.start);
    const dtEnd = localDateTime(firstDate, r.end);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${r.id}@chronos.local`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${fmtICSDate(dtStart)}`,
      `DTEND:${fmtICSDate(dtEnd)}`,
      `RRULE:FREQ=WEEKLY;BYDAY=${BYDAY[r.day]}`,
      `SUMMARY:${escapeICS(r.title)}`,
      `CATEGORIES:${r.kind}`,
      "END:VEVENT",
    );
  }
  for (const c of data.commitments) {
    const [y, mo, d] = c.date.split("-").map(Number);
    const base = new Date(y, mo - 1, d);
    const dtStart = localDateTime(base, c.start);
    const dtEnd = localDateTime(base, c.end);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${c.id}@chronos.local`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${fmtICSDate(dtStart)}`,
      `DTEND:${fmtICSDate(dtEnd)}`,
      `SUMMARY:${escapeICS(c.title)}`,
      `CATEGORIES:${c.kind}`,
      c.notes ? `DESCRIPTION:${escapeICS(c.notes)}` : "",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  const blob = new Blob([lines.filter(Boolean).join("\r\n")], { type: "text/calendar;charset=utf-8" });
  download(blob, filename);
}

function escapeICS(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export function exportToJSON(data: ScheduleData, filename = "chronos-schedule.json") {
  download(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), filename);
}