import { useMemo } from "react";
import { TimeSelect } from "@/components/ui/time-select";
import { Label } from "@/components/ui/label";
import { Moon, Sunrise } from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { timeToMinutes } from "@/lib/schedule/types";
import { fmtFriendlyDuration } from "@/lib/schedule/planner-format";

/** Bedtime → wake sleep control. Frames sleep the way people actually think
 *  about it ("I go to bed at 23:30 and wake at 07:00") instead of a raw
 *  start→end window, and detects the cross-midnight case automatically.
 *
 *  `bedtime`/`wake` map directly to the draft's `meta.sleepWindow.start`/`end`. */
export default function BedtimeWakeControl({
  bedtime,
  wake,
  onChange,
}: {
  bedtime: string;
  wake: string;
  onChange: (next: { bedtime: string; wake: string }) => void;
}) {
  const { bcp47, locale } = useI18n();
  const isPt = locale === "pt";

  const bedMin = timeToMinutes(bedtime);
  const wakeMin = timeToMinutes(wake);
  // Sleep that starts at/after wake numerically crosses midnight (the common case).
  const spansMidnight = bedMin >= wakeMin;
  const sleepMin = spansMidnight ? 24 * 60 - bedMin + wakeMin : wakeMin - bedMin;

  const sleepLabel = useMemo(
    () => fmtFriendlyDuration(sleepMin, isPt),
    [sleepMin, isPt],
  );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Moon className="h-3.5 w-3.5" />
            {isPt ? "Deitar" : "Bedtime"}
          </Label>
          <TimeSelect
            value={bedtime}
            onValueChange={(v) => onChange({ bedtime: v, wake })}
            bcp47={bcp47}
            placeholder={isPt ? "Horário" : "Time"}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Sunrise className="h-3.5 w-3.5" />
            {isPt ? "Acordar" : "Wake"}
          </Label>
          <TimeSelect
            value={wake}
            onValueChange={(v) => onChange({ bedtime, wake: v })}
            bcp47={bcp47}
            placeholder={isPt ? "Horário" : "Time"}
          />
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">
        {sleepMin <= 0
          ? (isPt ? "Ajuste para formar uma janela de sono válida." : "Adjust to form a valid sleep window.")
          : `${isPt ? "Sono" : "Sleep"}: ${sleepLabel}${
              spansMidnight ? (isPt ? " · atravessa a meia-noite" : " · spans midnight") : ""
            }`}
      </p>
    </div>
  );
}
