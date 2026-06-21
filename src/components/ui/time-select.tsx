import { Fragment, useEffect, useMemo, useRef, useState } from "react";
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

function matchesSearch(time: string, q: string, bcp47: string): boolean {
  const lq = q.toLowerCase();
  if (time.includes(lq)) return true;
  const display = formatTime(time, bcp47).toLowerCase();
  if (display.includes(lq)) return true;
  const hour = parseInt(time, 10);
  const hourStr = `${hour}`;
  if (hourStr === lq) return true;
  const hour12 = `${hour % 12 || 12}`;
  if (hour12 === lq) return true;
  if (lq === "am" || lq === "a.m.") return display.includes("am");
  if (lq === "pm" || lq === "p.m.") return display.includes("pm");
  return false;
}

function searchRelevance(time: string, q: string, bcp47: string): number {
  const lq = q.toLowerCase();
  const hour = parseInt(time, 10);
  // Tier 1: 24h hour matches query exactly
  if (`${hour}` === lq) return 0;
  // Tier 2: 12h hour matches query exactly
  const hour12 = `${hour % 12 || 12}`;
  if (hour12 === lq) return 1;
  // Tier 3: any other match
  return 2;
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
  const [search, setSearch] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

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

  const filteredGroups = useMemo(() => {
    if (!search) return groups;
    const q = search.toLowerCase();
    const flat = groups
      .flatMap((g) => g.items.filter((t) => matchesSearch(t, q, bcp47)))
      .sort((a, b) => {
        const ra = searchRelevance(a, q, bcp47);
        const rb = searchRelevance(b, q, bcp47);
        if (ra !== rb) return ra - rb;
        return toMin(a) - toMin(b);
      });
    if (!flat.length) return [];
    return [{ hour: "_search", items: flat }];
  }, [groups, search, bcp47]);

  useEffect(() => {
    if (open && value && listRef.current) {
      const el = listRef.current.querySelector(`[data-value="${value}"]`);
      if (el) el.scrollIntoView({ block: "center", behavior: "auto" });
    }
  }, [open, value]);

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSearch(""); }}>
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
      <PopoverContent className="w-[220px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search time…"
            className="h-9"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList ref={listRef} className="max-h-[300px]">
            <CommandEmpty>No time found.</CommandEmpty>
            {filteredGroups.map((group, i) => (
              <Fragment key={group.hour}>
                {i > 0 && group.hour !== "_search" && <CommandSeparator />}
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
