import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";

const TIME_OPTIONS = Array.from({ length: 24 * 4 }, (_, i) => {
  const minutes = i * 15;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
});

function formatTimeLabel(value: string, bcp47: string) {
  const [h, m] = value.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString(bcp47, { hour: "numeric", minute: "2-digit" });
}

export function TimeSelect({
  value,
  onValueChange,
  bcp47,
  className,
}: {
  value: string;
  onValueChange: (value: string) => void;
  bcp47: string;
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={className}>{formatTimeLabel(value, bcp47)}</SelectTrigger>
      <SelectContent className="max-h-72">
        {TIME_OPTIONS.map((time) => (
          <SelectItem key={time} value={time}>
            {formatTimeLabel(time, bcp47)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}