import { useMemo } from "react";
import type { ScheduleData } from "@/lib/schedule/types";
import { timeToMinutes } from "@/lib/schedule/types";
import { safeKindStyle, TAILWIND_TO_HEX } from "@/components/dashboard/widgets";
import { useI18n } from "@/lib/i18n/I18nProvider";

/** A compact, read-only 7-day strip of a draft schedule. Each day renders its
 *  routine blocks proportionally so the user can see the shape of the week as
 *  they refine the draft — before anything is committed to the live store. */
export default function DraftWeekPreview({ draft }: { draft: ScheduleData }) {
  const { locale } = useI18n();
  const dayLabels = locale === "pt"
    ? ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]
    : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const blocksByDay = useMemo(() => {
    const byDay: { day: number; blocks: ScheduleData["routine"] }[] = [];
    for (let d = 0; d < 7; d++) {
      const blocks = draft.routine
        .filter((b) => b.day === d && b.kind !== "sleep")
        .slice()
        .sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
      byDay.push({ day: d, blocks });
    }
    return byDay;
  }, [draft.routine]);

  return (
    <div className="space-y-1.5">
      {blocksByDay.map(({ day, blocks }) => (
        <div key={day} className="flex items-center gap-3 text-xs">
          <span className="w-8 text-right text-muted-foreground font-medium">{dayLabels[day]}</span>
          <div className="flex-1 flex gap-0.5 h-5">
            {blocks.length === 0 ? (
              <div className="flex-1 rounded bg-muted/30" />
            ) : (
              blocks.map((b, i) => {
                const s = safeKindStyle(b.kind, draft.categories);
                const hex = s.customColor ?? TAILWIND_TO_HEX[s.dot] ?? "#6366f1";
                const span = Math.max(15, timeToMinutes(b.end) - timeToMinutes(b.start));
                return (
                  <div
                    key={i}
                    className="rounded first:rounded-l-md last:rounded-r-md min-w-[4px]"
                    style={{ backgroundColor: hex, flexGrow: span }}
                    title={`${b.title} (${b.start}–${b.end})`}
                  />
                );
              })
            )}
          </div>
          <span className="w-6 text-right text-muted-foreground/60 num">{blocks.length}</span>
        </div>
      ))}
    </div>
  );
}
