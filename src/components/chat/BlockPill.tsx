import { useState } from "react";
import { Moon, Target, CheckCircle2, XCircle, ChevronDown, ChevronUp } from "lucide-react";
import { safeKindStyle } from "@/components/dashboard/widgets";
import type { ScheduleData } from "@/lib/schedule/types";

export interface BlockPillProps {
  title: string;
  start?: string;
  end?: string;
  kind?: string;
  categories?: ScheduleData["categories"];
  action?: "added" | "removed" | "modified";
}

function formatTime(t?: string) {
  if (!t) return "";
  return t.length <= 5 ? t : t.slice(0, 5);
}

export function BlockPill({ title, start, end, kind, categories, action }: BlockPillProps) {
  const [expanded, setExpanded] = useState(false);
  const style = safeKindStyle(kind ?? "", categories);
  const IconComponent = style.icon;
  const DotIcon = action === "removed" ? XCircle : action === "added" ? CheckCircle2 : null;
  const isRemoved = action === "removed";

  const fullLabel = [title, start && end ? `${formatTime(start)}–${formatTime(end)}` : "", kind ? `(${kind})` : ""].filter(Boolean).join(" ");

  return (
    <div className="flex flex-col">
      <button
        type="button"
        title={fullLabel}
        onClick={() => setExpanded(!expanded)}
        className={`border inline-flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-md text-[11px] font-medium leading-none cursor-pointer transition-shadow hover:shadow-sm active:scale-[0.97] ${style.chip} ${style.blockBorder}`}
        style={{
          ...style.chipStyle,
          ...(style.customColor ? { borderColor: style.chipStyle?.color ? `${style.chipStyle.color}66` : undefined } : {}),
          opacity: isRemoved ? 0.75 : 1,
          textDecoration: isRemoved ? "line-through" : "none",
        }}
      >
        <div className="flex items-center gap-1 min-w-0 flex-1">
          <span className={`h-3 w-0.5 rounded-full shrink-0 ${style.dot}`} style={style.dotStyle} />
          {DotIcon ? (
            <DotIcon className="h-3 w-3 shrink-0" style={{ color: style.chipStyle?.color ?? undefined }} />
          ) : (
            <IconComponent className="h-3 w-3 shrink-0" />
          )}
          <span className="truncate max-w-[120px]">{title}</span>
        </div>
        {(start || end) && (
          <span className="tabular-nums opacity-70 shrink-0">
            {formatTime(start)}–{formatTime(end)}
          </span>
        )}
        {expanded ? <ChevronUp className="h-3 w-3 ml-1 shrink-0 opacity-50" /> : <ChevronDown className="h-3 w-3 ml-1 shrink-0 opacity-50" />}
      </button>
      {expanded && (
        <div className="mt-1 ml-1 px-2.5 py-1.5 rounded-md bg-secondary/5 border border-border/40 text-[11px] text-muted-foreground space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="font-medium text-primary/80">{action === "added" ? "Added" : action === "removed" ? "Removed" : "Modified"}</span>
            {kind && <span className="px-1.5 py-0.5 rounded-full bg-secondary/20 text-[10px]">kind: {kind}</span>}
          </div>
          <p>{fullLabel}</p>
        </div>
      )}
    </div>
  );
}

interface GoalPillProps {
  title: string;
  target?: number;
  unit?: string;
  categoryId?: string;
  categories?: ScheduleData["categories"];
}

export function GoalPill({ title, target, unit, categoryId, categories }: GoalPillProps) {
  const style = categoryId ? safeKindStyle(categoryId, categories) : safeKindStyle("", categories);
  return (
    <div
      className={`border inline-flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-md text-[11px] font-medium leading-none ${style.chip} ${style.blockBorder}`}
      style={{
        ...style.chipStyle,
        ...(style.customColor ? { borderColor: `${style.chipStyle?.color}66` } : {}),
      }}
    >
      <span className={`h-3 w-0.5 rounded-full shrink-0 ${style.dot}`} style={style.dotStyle} />
      <Target className="h-3 w-3 shrink-0" />
      <span className="truncate max-w-[160px]">{title}</span>
      {target && (
        <span className="tabular-nums opacity-70 shrink-0">{target}{unit ? ` ${unit}` : ""}</span>
      )}
    </div>
  );
}

interface SleepPillProps {
  start: string;
  end: string;
}

export function SleepPill({ start, end }: SleepPillProps) {
  const style = safeKindStyle("sleep");
  return (
    <div
      className={`border inline-flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-md text-[11px] font-medium leading-none ${style.chip} ${style.blockBorder}`}
      style={{
        ...style.chipStyle,
        ...(style.customColor ? { borderColor: `${style.chipStyle?.color}66` } : {}),
      }}
    >
      <span className={`h-3 w-0.5 rounded-full shrink-0 ${style.dot}`} style={style.dotStyle} />
      <Moon className="h-3 w-3 shrink-0" />
      <span>Sleep</span>
      <span className="tabular-nums opacity-70 shrink-0">{formatTime(start)}–{formatTime(end)}</span>
    </div>
  );
}

interface CategoryPillProps {
  id: string;
  label: string;
  categories?: ScheduleData["categories"];
}

export function CategoryPill({ id, label, categories }: CategoryPillProps) {
  const style = safeKindStyle(id, categories);
  return (
    <div
      className={`border inline-flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-md text-[11px] font-medium leading-none ${style.chip} ${style.blockBorder}`}
      style={{
        ...style.chipStyle,
        ...(style.customColor ? { borderColor: `${style.chipStyle?.color}66` } : {}),
      }}
    >
      <span className={`h-3 w-0.5 rounded-full shrink-0 ${style.dot}`} style={style.dotStyle} />
      <span>{label}</span>
    </div>
  );
}

export function BlockBadge({ title, kind, categories }: { title: string; kind?: string; categories?: ScheduleData["categories"] }) {
  const style = safeKindStyle(kind ?? "", categories);
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[11px] font-medium leading-none mx-0.5 align-middle ${style.chip}`}
      style={style.chipStyle as React.CSSProperties}
    >
      <span className={`h-2 w-0.5 rounded-full shrink-0 ${style.dot}`} style={style.dotStyle} />
      {title}
    </span>
  );
}

interface BlockSectionProps {
  title: string;
  items: React.ReactNode[];
  icon?: React.ReactNode;
}

export function BlockSection({ title, items, icon }: BlockSectionProps) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium">
        {icon}
        <span>{title}</span>
      </div>
      <div className="flex flex-col gap-1">
        {items}
      </div>
    </div>
  );
}

type ToolCall = {
  tool: string;
  params: Record<string, unknown>;
  error?: string;
  result?: Record<string, unknown>;
};

// Extracts confirmed block changes from tool call results.
// For proposed (pre-confirmation) changes, see extractProposedBlockData below.
export function extractBlockData(
  msg: { content: string; toolCalls?: ToolCall[] },
  data?: ScheduleData
): BlockPillProps[] {
  if (!msg.toolCalls?.length || !data) return [];

  const blocks: BlockPillProps[] = [];
  const allBlocks = [...data.routine, ...data.commitments];

  for (const tc of msg.toolCalls) {
    if (tc.error) continue;

    if (tc.tool === "createBlock" || tc.tool === "addCommitment") {
      const p = tc.params;
      if (p.title && p.start && p.end) {
        blocks.push({
          title: String(p.title),
          start: String(p.start),
          end: String(p.end),
          kind: String(p.category ?? ""),
          categories: data.categories,
          action: "added",
        });
      }
    }

    if (tc.tool === "deleteBlock" || tc.tool === "removeCommitment") {
      const r = tc.result;
      if (r?.title) {
        blocks.push({
          title: String(r.title),
          start: String(r.start ?? ""),
          end: String(r.end ?? ""),
          kind: String(r.category ?? ""),
          categories: data.categories,
          action: "removed",
        });
      }
    }

    if (tc.tool === "updateBlock") {
      const blockId = String(tc.params.blockId ?? "");
      const patch = (tc.params.patch as Record<string, unknown>) ?? {};
      const found = allBlocks.find(b => b.id === blockId);
      if (found) {
        blocks.push({
          title: String(patch.title ?? found.title),
          start: String(patch.start ?? found.start),
          end: String(patch.end ?? found.end),
          kind: String(patch.category ?? found.kind),
          categories: data.categories,
          action: "modified",
        });
      }
    }

    if (tc.tool === "moveBlock") {
      const blockId = String(tc.params.blockId ?? "");
      const found = allBlocks.find(b => b.id === blockId);
      if (found) {
        blocks.push({
          title: found.title,
          start: String(tc.params.newStart ?? found.start),
          end: String(tc.params.newEnd ?? found.end),
          kind: found.kind,
          categories: data.categories,
          action: "modified",
        });
      }
    }
  }

  const seen = new Set<string>();
  return blocks.filter(b => {
    const key = `${b.action}:${b.title.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Same per-tool mapping as extractBlockData, for [PROPOSE:...] calls instead
// of executed msg.toolCalls — see extractProposedCalls in chat/service.ts.
// Nothing has run yet, so there's no tc.result to read a deleted/updated
// block's title from; every id-referencing tool resolves blockId → title from
// the live `data` instead (the block still exists at proposal time).
export function extractProposedBlockData(
  calls: Array<{ tool: string; params: Record<string, unknown> }>,
  data?: ScheduleData,
): BlockPillProps[] {
  if (!calls.length || !data) return [];

  const blocks: BlockPillProps[] = [];
  const allBlocks = [...data.routine, ...data.commitments];

  for (const call of calls) {
    const p = call.params;

    if (call.tool === "createBlock" || call.tool === "addCommitment") {
      if (p.title && p.start && p.end) {
        blocks.push({
          title: String(p.title),
          start: String(p.start),
          end: String(p.end),
          kind: String(p.category ?? ""),
          categories: data.categories,
          action: "added",
        });
      }
    }

    if (call.tool === "deleteBlock" || call.tool === "removeCommitment") {
      const id = String(p.blockId ?? p.commitmentId ?? "");
      const found = allBlocks.find(b => b.id === id);
      if (found) {
        blocks.push({
          title: found.title,
          start: found.start,
          end: found.end,
          kind: found.kind,
          categories: data.categories,
          action: "removed",
        });
      }
    }

    if (call.tool === "updateBlock" || call.tool === "updateCommitment") {
      const id = String(p.blockId ?? p.commitmentId ?? "");
      const patch = (p.patch as Record<string, unknown>) ?? {};
      const found = allBlocks.find(b => b.id === id);
      if (found) {
        blocks.push({
          title: String(patch.title ?? found.title),
          start: String(patch.start ?? found.start),
          end: String(patch.end ?? found.end),
          kind: String(patch.category ?? found.kind),
          categories: data.categories,
          action: "modified",
        });
      }
    }

    if (call.tool === "moveBlock") {
      const id = String(p.blockId ?? "");
      const found = allBlocks.find(b => b.id === id);
      if (found) {
        blocks.push({
          title: found.title,
          start: String(p.newStart ?? found.start),
          end: String(p.newEnd ?? found.end),
          kind: found.kind,
          categories: data.categories,
          action: "modified",
        });
      }
    }
  }

  const seen = new Set<string>();
  return blocks.filter(b => {
    const key = `${b.action}:${b.title.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
