import { Moon, Sunrise } from "lucide-react";
import { timeToMinutes } from "@/lib/schedule/types";
import { fmtFriendlyDuration } from "@/lib/schedule/planner-format";
import { useI18n } from "@/lib/i18n/I18nProvider";

/** A read-only 24-hour ribbon of the sleep window. Renders the night band
 *  (with cross-midnight split into two segments) plus bedtime/wake markers —
 *  an actual picture of the night, not just two time readouts. */
export default function SleepRibbon({
  bedtime,
  wake,
  className = "",
}: {
  bedtime: string;
  wake: string;
  className?: string;
}) {
  const { locale } = useI18n();
  const isPt = locale === "pt";

  const bedMin = timeToMinutes(bedtime);
  const wakeMin = timeToMinutes(wake);
  const spansMidnight = bedMin >= wakeMin;
  const sleepMin = spansMidnight ? 24 * 60 - bedMin + wakeMin : wakeMin - bedMin;
  const segments = spansMidnight
    ? [{ start: 0, end: wakeMin }, { start: bedMin, end: 24 * 60 }]
    : [{ start: bedMin, end: wakeMin }];

  const pct = (min: number) => `${(min / (24 * 60)) * 100}%`;
  const ticks = [0, 6, 12, 18, 24];

  return (
    <div className={className}>
      {/* 24h track: light "day" base with the sleep band laid over it */}
      <div className="relative h-7 rounded-full bg-gradient-to-r from-amber-200/20 via-sky-200/15 to-amber-200/20 dark:from-amber-100/10 dark:via-sky-100/8 dark:to-amber-100/10 border border-border/50 overflow-hidden">
        {segments.map((seg, i) => (
          <div
            key={i}
            className="absolute inset-y-0 bg-indigo-500/55 dark:bg-indigo-400/45"
            style={{ left: pct(seg.start), width: pct(seg.end - seg.start) }}
          />
        ))}
        {/* Bedtime marker */}
        <div className="absolute inset-y-0 w-px bg-indigo-300/80" style={{ left: pct(bedMin) }} />
        <Moon
          className="absolute top-1/2 h-3 w-3 -translate-y-1/2 -translate-x-1/2 text-indigo-200"
          style={{ left: pct(bedMin) }}
        />
        {/* Wake marker */}
        <div className="absolute inset-y-0 w-px bg-amber-300/90" style={{ left: pct(wakeMin) }} />
        <Sunrise
          className="absolute top-1/2 h-3 w-3 -translate-y-1/2 -translate-x-1/2 text-amber-300"
          style={{ left: pct(wakeMin) }}
        />
      </div>

      {/* Hour axis */}
      <div className="relative mt-1 h-3">
        {ticks.map((h) => (
          <span
            key={h}
            className="absolute -translate-x-1/2 text-[9px] num text-muted-foreground/55"
            style={{ left: pct(h * 60) }}
          >
            {h}h
          </span>
        ))}
      </div>

      <div className="mt-1.5 flex items-center justify-between text-[11px]">
        <span className="flex items-center gap-1 text-muted-foreground">
          <Moon className="h-3 w-3 text-indigo-400" /> {bedtime}
          <span className="mx-1 text-muted-foreground/40">→</span>
          <Sunrise className="h-3 w-3 text-amber-400" /> {wake}
        </span>
        <span className="text-muted-foreground num">
          {fmtFriendlyDuration(sleepMin, isPt)}
        </span>
      </div>
    </div>
  );
}
