import { Fragment, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { Clock } from "lucide-react";

const OPTIONS = Array.from({ length: 24 * 4 }, (_, i) => {
  const m = i * 15;
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
});

function formatTime(value: string, bcp47: string) {
  if (value === "24:00") {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toLocaleTimeString(bcp47, { hour: "numeric", minute: "2-digit" });
  }
  const [h, m] = value.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return value;
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString(bcp47, { hour: "numeric", minute: "2-digit" });
}

function toMin(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

export function TimeSelect({
  value,
  onValueChange,
  bcp47,
  className,
  placeholder,
  min,
  max,
  exclude,
  allowMidnight,
  times,
}: {
  value: string;
  onValueChange: (value: string) => void;
  bcp47: string;
  className?: string;
  placeholder?: string;
  min?: string;
  max?: string;
  exclude?: string[];
  allowMidnight?: boolean;
  times?: string[];
}) {
  const [open, setOpen] = useState(false);

  const groups = useMemo(() => {
    const lo = min != null ? toMin(min) : 0;
    const hi = max != null ? toMin(max) : 24 * 60;
    const excluded = new Set(exclude);
    const items = times ?? (allowMidnight ? [...OPTIONS, "24:00"] : OPTIONS);

    const result: { hour: string; items: string[] }[] = [];
    let curHour = "";
    let curItems: string[] = [];

    for (const time of items) {
      if (excluded.has(time)) continue;
      const tm = toMin(time);
      if (tm < lo || tm > hi) continue;
      const hour = time === "24:00" ? "24" : time.slice(0, 2);
      if (hour !== curHour) {
        if (curItems.length) result.push({ hour: curHour, items: curItems });
        curHour = hour;
        curItems = [];
      }
      curItems.push(time);
    }
    if (curItems.length) result.push({ hour: curHour, items: curItems });
    return result;
  }, [min, max, exclude, allowMidnight]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "h-9 w-full justify-between font-normal",
            !value && "text-muted-foreground",
            className,
          )}
        >
          {value ? formatTime(value, bcp47) : (placeholder ?? "Select time")}
          <Clock className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search time&hellip;" className="h-9" />
          <CommandList className="max-h-[260px]">
            <CommandEmpty>No time found.</CommandEmpty>
            {groups.map((group, i) => (
              <Fragment key={group.hour}>
                {i > 0 && <CommandSeparator />}
                <CommandGroup>
                  {group.items.map((time) => (
                    <CommandItem
                      key={time}
                      value={time}
                      onSelect={(currentValue) => {
                        onValueChange(currentValue);
                        setOpen(false);
                      }}
                    >
                      {formatTime(time, bcp47)}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </Fragment>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
