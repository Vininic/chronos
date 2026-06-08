import { useMemo } from "react";
import type { Goal, ProgressSnapshot } from "@/lib/schedule/types";

interface Props {
  goal: Goal;
  snapshots: ProgressSnapshot[];
  height?: number;
}

export function ProgressChart({ goal, snapshots, height = 80 }: Props) {
  const data = useMemo(() => {
    const goalSnaps = snapshots
      .filter((s) => s.goalId === goal.id)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30);
    if (goalSnaps.length < 2) return null;
    const maxRatio = Math.max(1, ...goalSnaps.map((s) => s.denominator > 0 ? Math.min(1, s.numerator / s.denominator) : 0));
    return { points: goalSnaps, maxRatio };
  }, [goal.id, snapshots]);

  if (!data) return null;

  const w = 120;
  const h = height;
  const pad = 2;
  const chartW = w - pad * 2;
  const chartH = h - pad * 2;
  const stepX = chartW / (data.points.length - 1);

  const pathD = data.points.map((p, i) => {
    const x = pad + i * stepX;
    const ratio = p.denominator > 0 ? Math.min(1, p.numerator / p.denominator) : 0;
    const y = pad + chartH - (ratio / data.maxRatio) * chartH;
    return `${i === 0 ? "M" : "L"}${x},${y}`;
  }).join("");

  const fillD = data.points.map((p, i) => {
    const x = pad + i * stepX;
    const ratio = p.denominator > 0 ? Math.min(1, p.numerator / p.denominator) : 0;
    const y = pad + chartH - (ratio / data.maxRatio) * chartH;
    return `${i === 0 ? "M" : "L"}${x},${y}`;
  }).join("") + `L${pad + (data.points.length - 1) * stepX},${pad + chartH}L${pad},${pad + chartH}Z`;

  return (
    <svg width={w} height={h} className="shrink-0" viewBox={`0 0 ${w} ${h}`}>
      <defs>
        <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--secondary))" stopOpacity="0.25" />
          <stop offset="100%" stopColor="hsl(var(--secondary))" stopOpacity="0.04" />
        </linearGradient>
      </defs>
      <path d={fillD} fill="url(#chart-fill)" />
      <path d={pathD} fill="none" stroke="hsl(var(--secondary))" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
