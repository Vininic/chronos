import { useRef, useEffect, useMemo, memo, type ReactNode } from "react";
import type { ChatMessage, FileAttachment } from "@/lib/ai/chat/store";
import type { ScheduleData } from "@/lib/schedule/types";
import {
  CheckCircle2, AlertCircle, Undo2, Clock, Sparkles,
} from "lucide-react";
import { BlockPill, BlockBadge, BlockSection, extractBlockData, extractProposedBlockData } from "./BlockPill";
import { extractProposedCalls } from "@/lib/ai/chat/service";

// ─── Utilities ─────────────────────────────────────────────────────────────

function formatTime(ts: string) {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

const WRITE_TOOLS = new Set(["createBlock","updateBlock","deleteBlock","moveBlock","splitBlock","mergeBlocks","addCommitment","removeCommitment","updateCommitment"]);

// ─── Inline renderer ────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Escapes first, then applies a small, safe subset of inline markdown: links
// (http/https only), bold, and inline code. Order matters — links are matched
// on the escaped string before bold/code so their text can still be emphasized.
// Returns ReactNode[] instead of raw HTML to avoid dangerouslySetInnerHTML.
function renderRichHtml(raw: string): ReactNode[] {
  const escaped = escapeHtml(raw);
  const nodes: ReactNode[] = [];
  const combined = /(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))|(\*\*([^*]+)\*\*)|(`([^`]+)`)/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = combined.exec(escaped)) !== null) {
    if (m.index > lastIndex) {
      nodes.push(escaped.slice(lastIndex, m.index));
    }
    if (m[1]) {
      const url = m[3].replace(/"/g, "%22");
      nodes.push(
        <a key={m.index} href={url} target="_blank" rel="noopener noreferrer"
          className="text-secondary underline underline-offset-2 decoration-secondary/40 hover:decoration-secondary">
          {m[2]}
        </a>
      );
    } else if (m[4]) {
      nodes.push(<strong key={m.index} className="font-semibold text-primary">{m[5]}</strong>);
    } else if (m[6]) {
      nodes.push(
        <code key={m.index} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em] text-primary/80">
          {m[7]}
        </code>
      );
    }
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < escaped.length) {
    nodes.push(escaped.slice(lastIndex));
  }
  return nodes;
}

function renderInline(
  text: string,
  blockByTitle: Map<string, { kind: string }>,
  categories: ScheduleData["categories"] | undefined,
): (JSX.Element | null)[] {
  const parts = text.split(/"([^"]+)"/);
  return parts.map((part, i) => {
    if (i % 2 === 0) {
      if (!part) return null;
      return <span key={i}>{renderRichHtml(part)}</span>;
    }
    const block = blockByTitle.get(part.toLowerCase());
    if (!block) return <span key={i}>"{part}"</span>;
    return <BlockBadge key={i} title={part} kind={block.kind} categories={categories} />;
  });
}

// ─── Markdown renderer ───────────────────────────────────────────────────────

function ChatMarkdown({ text, data }: { text: string; data?: ScheduleData }) {
  const blockByTitle = useMemo(() => {
    const all = [...(data?.routine ?? []), ...(data?.commitments ?? [])];
    return new Map(all.map(b => [b.title.toLowerCase(), b]));
  }, [data]);

  const lines = text.split("\n");
  const elements: JSX.Element[] = [];

  let fence: string[] | null = null;
  lines.forEach((line, i) => {
    // Fenced code blocks (```) — collect lines until the closing fence.
    if (line.trim().startsWith("```")) {
      if (fence) {
        elements.push(
          <pre key={i} className="my-1.5 overflow-x-auto rounded-md border border-border/50 bg-muted/40 px-3 py-2 font-mono text-[12px] leading-relaxed text-primary/80">
            {fence.join("\n")}
          </pre>
        );
        fence = null;
      } else {
        fence = [];
      }
      return;
    }
    if (fence) { fence.push(line); return; }

    const trimmed = line.trim();
    if (!trimmed) { elements.push(<div key={i} className="h-1.5" />); return; }

    // Horizontal rule — a bronze hairline, consistent with the app's dividers.
    if (/^---+$/.test(trimmed)) {
      elements.push(<div key={i} className="bronze-rule my-2 opacity-60" />);
      return;
    }

    // Headings — ## is the dominant heading (editorial serif), ### a quiet
    // bronze eyebrow beneath it. (Previously inverted: ### read larger than ##.)
    if (trimmed.startsWith("### ")) {
      elements.push(
        <p key={i} className="text-[10px] font-medium uppercase tracking-[0.18em] text-secondary mt-2 mb-0.5">
          {renderInline(trimmed.slice(4), blockByTitle, data?.categories)}
        </p>
      );
      return;
    }
    if (trimmed.startsWith("## ")) {
      elements.push(
        <p key={i} className="font-display text-[15px] leading-snug text-primary mt-2 mb-1">
          {renderInline(trimmed.slice(3), blockByTitle, data?.categories)}
        </p>
      );
      return;
    }

    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      elements.push(
        <li key={i} className="text-sm text-primary/90 ml-4 list-disc marker:text-secondary/60">
          {renderInline(trimmed.slice(2), blockByTitle, data?.categories)}
        </li>
      );
      return;
    }
    if (/^\d+\.\s/.test(trimmed)) {
      elements.push(
        <li key={i} className="text-sm text-primary/90 ml-4 list-decimal marker:text-secondary/60">
          {renderInline(trimmed.replace(/^\d+\.\s/, ""), blockByTitle, data?.categories)}
        </li>
      );
      return;
    }
    elements.push(
      <p key={i} className="text-sm text-primary/90 leading-relaxed">
        {renderInline(trimmed, blockByTitle, data?.categories)}
      </p>
    );
  });

  // Unclosed fence — render whatever we collected so streaming code still shows.
  if (fence && fence.length > 0) {
    elements.push(
      <pre key="fence-open" className="my-1.5 overflow-x-auto rounded-md border border-border/50 bg-muted/40 px-3 py-2 font-mono text-[12px] leading-relaxed text-primary/80">
        {fence.join("\n")}
      </pre>
    );
  }

  return <div className="space-y-0.5">{elements}</div>;
}

// ─── Unified action ledger ────────────────────────────────────────────────
// One component family for every tool-call state: proposed (described, not yet
// run), applied (succeeded), error (failed), undone (reverted). Same frame and
// layout throughout — the accent is the only thing that changes — so a planned
// change and an executed one read as two states of one thing, not two designs.

type LedgerState = "proposed" | "applied" | "error" | "undone";

const LEDGER_META: Record<LedgerState, { label: string; Icon: typeof Clock; border: string; accent: string }> = {
  proposed: { label: "Proposed",      Icon: Clock,        border: "border-secondary/30",   accent: "text-secondary" },
  applied:  { label: "Applied",       Icon: CheckCircle2, border: "border-emerald-500/30", accent: "text-emerald-600 dark:text-emerald-400" },
  error:    { label: "Couldn't apply", Icon: AlertCircle, border: "border-destructive/40", accent: "text-destructive" },
  undone:   { label: "Undone",        Icon: Undo2,        border: "border-amber-500/30",   accent: "text-amber-600 dark:text-amber-400" },
};

function ActionLedger({ state, footer, children }: { state: LedgerState; footer?: React.ReactNode; children: React.ReactNode }) {
  const m = LEDGER_META[state];
  return (
    <div className={`mt-2 overflow-hidden rounded-lg border bg-card/40 ${m.border}`}>
      <div className="flex items-center gap-1.5 border-b border-border/30 px-3 py-1.5">
        <m.Icon className={`h-3 w-3 shrink-0 ${m.accent}`} />
        <span className={`text-[10px] font-medium uppercase tracking-[0.18em] ${m.accent}`}>{m.label}</span>
        {footer && <div className="ml-auto flex items-center gap-1.5">{footer}</div>}
      </div>
      <div className="px-3 py-2.5">{children}</div>
    </div>
  );
}

// Compact tool-name chips + optional undo, used in a ledger header or inline.
function ToolChips({ calls, onUndo }: { calls: NonNullable<ChatMessage["toolCalls"]>; onUndo?: () => void }) {
  return (
    <>
      {calls.map((tc, i) => (
        <span key={i} className="font-mono text-[10px] text-muted-foreground/70">{tc.tool}</span>
      ))}
      {onUndo && (
        <button
          onClick={onUndo}
          className="ml-1 inline-flex items-center gap-1 rounded-full border border-border/50 px-2 py-0.5 text-[10px] text-muted-foreground transition-colors hover:border-secondary/40 hover:text-primary"
        >
          <Undo2 className="h-3 w-3" /> Undo
        </button>
      )}
    </>
  );
}

// Block pills grouped by change kind — shared by applied and proposed ledgers.
// Both now resolve to the same BlockPillProps[] shape (extractBlockData for
// executed [TOOL:...] calls, extractProposedBlockData for not-yet-run
// [PROPOSE:...] ones), so one renderer covers both instead of two near-
// duplicate ones (the old ProposedGroups re-derived this from regex-parsed
// prose with its own label/category guessing).
function BlockGroups({ blocks }: { blocks: ReturnType<typeof extractBlockData> }) {
  if (blocks.length === 0) return null;
  const added    = blocks.filter(b => b.action === "added");
  const removed  = blocks.filter(b => b.action === "removed");
  const modified = blocks.filter(b => b.action === "modified");
  return (
    <div className="space-y-2.5">
      {removed.length > 0 && (
        <BlockSection title="Removed" icon={<AlertCircle className="h-3 w-3 text-destructive" />}
          items={removed.map((b, i) => <BlockPill key={i} {...b} />)} />
      )}
      {added.length > 0 && (
        <BlockSection title="Added" icon={<CheckCircle2 className="h-3 w-3 text-emerald-500" />}
          items={added.map((b, i) => <BlockPill key={i} {...b} />)} />
      )}
      {modified.length > 0 && (
        <BlockSection title="Modified" icon={<Undo2 className="h-3 w-3 text-amber-500" />}
          items={modified.map((b, i) => <BlockPill key={i} {...b} />)} />
      )}
    </div>
  );
}

// ─── Message content ─────────────────────────────────────────────────────────
// Proposed (not-yet-executed) changes arrive as [PROPOSE:tool]{json}[/PROPOSE]
// tags inline in msg.content — same tag/JSON convention as real [TOOL:...]
// calls (see PROPOSE_FORMAT_INSTRUCTION in chat/service.ts), so parsing is a
// plain regex+JSON.parse (extractProposedCalls) instead of the old free-text
// "Actions:" section regex-parser. The tags stay in msg.content (never
// stripped, same as the old "Actions:" prose never was) — this component is
// what splits prose from tags for display.

const PROPOSE_TAG_RE = /\[PROPOSE:\w+\][\s\S]*?\[\/PROPOSE\]/g;

function ChatMessageContent({ msg, data, onUndo }: { msg: ChatMessage; data?: ScheduleData; onUndo?: () => void }) {
  const hasToolCalls = (msg.toolCalls?.length ?? 0) > 0;
  const hasWriteCalls = msg.toolCalls?.some(tc => !tc.error && WRITE_TOOLS.has(tc.tool)) ?? false;
  // Only show the proposal card when the AI hasn't already executed the changes
  const hasProposals = !hasWriteCalls && PROPOSE_TAG_RE.test(msg.content);

  const confirmedBlocks = useMemo(
    () => (hasWriteCalls ? extractBlockData(msg, data) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [msg.id, msg.toolCalls, data, hasWriteCalls],
  );

  const proposedBlocks = useMemo(
    () => (hasProposals ? extractProposedBlockData(extractProposedCalls(msg.content), data) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [msg.id, msg.content, hasProposals, data],
  );

  // Split content around the [PROPOSE:...] tags: everything before the first
  // one is the lead-in prose, everything after the last one is closing text.
  const { displayText, closingText } = useMemo(() => {
    if (!hasProposals) return { displayText: msg.content, closingText: "" };
    PROPOSE_TAG_RE.lastIndex = 0;
    const matches = [...msg.content.matchAll(PROPOSE_TAG_RE)];
    const first = matches[0];
    const last = matches[matches.length - 1];
    const firstIdx = first.index ?? 0;
    const lastEnd = (last.index ?? 0) + last[0].length;
    return {
      displayText: msg.content.slice(0, firstIdx).trim(),
      closingText: msg.content.slice(lastEnd).trim(),
    };
  }, [msg.content, hasProposals]);

  // Executed-write state drives the ledger accent: undone wins, then error, else applied.
  const execState: LedgerState = msg.toolCalls?.some(tc => tc.undone)
    ? "undone"
    : msg.toolCalls?.some(tc => tc.error)
      ? "error"
      : "applied";

  return (
    <>
      {displayText && <ChatMarkdown text={displayText} data={data} />}

      {hasWriteCalls ? (
        <ActionLedger
          state={execState}
          footer={<ToolChips calls={msg.toolCalls!} onUndo={execState === "undone" ? undefined : onUndo} />}
        >
          {confirmedBlocks.length > 0
            ? <BlockGroups blocks={confirmedBlocks} />
            : <p className="text-[11px] text-primary/60">Schedule updated.</p>}
        </ActionLedger>
      ) : hasToolCalls ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <ToolChips calls={msg.toolCalls!} onUndo={onUndo} />
        </div>
      ) : null}

      {hasProposals && (
        <ActionLedger state="proposed">
          {proposedBlocks.length > 0
            ? <BlockGroups blocks={proposedBlocks} />
            : <p className="text-[11px] text-primary/60">Proposed changes.</p>}
        </ActionLedger>
      )}

      {closingText && (
        <div className="mt-2 opacity-75">
          <ChatMarkdown text={closingText} data={data} />
        </div>
      )}
    </>
  );
}

// ─── Aetheris frame & thinking indicator ─────────────────────────────────────
// Assistant turns aren't bubbles — they're entries in a ledger, marked by a
// bronze spine and a quiet byline. This is the one shape language the whole
// thread shares (proposals, tool runs, prose all sit inside it).

function AetherisFrame({ time, children }: { time?: string; children: React.ReactNode }) {
  return (
    <div className="relative pl-4">
      <span
        aria-hidden
        className="absolute left-0 top-1 bottom-1 w-px bg-gradient-to-b from-secondary/70 via-secondary/30 to-transparent"
      />
      <div className="mb-1 flex items-center gap-1.5">
        <Sparkles className="h-3 w-3 text-secondary" />
        <span className="font-display text-[13px] leading-none text-primary">Aetheris</span>
        {time && <span className="ml-auto text-[10px] tabular-nums text-muted-foreground/70">{time}</span>}
      </div>
      <div className="break-words">{children}</div>
    </div>
  );
}

function ThinkingDots() {
  return (
    <div className="flex items-center gap-1 py-1" aria-label="Aetheris is thinking">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-secondary/70 animate-pulse motion-reduce:animate-none"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </div>
  );
}

// ─── Message row ─────────────────────────────────────────────────────────────

interface MessageRowProps {
  msg: ChatMessage;
  data?: ScheduleData;
  onUndo?: (messageId: string) => void;
}

// Memoized so historical messages don't re-render during streaming text updates.
const MessageRow = memo(function MessageRow({ msg, data, onUndo }: MessageRowProps) {
  const isUser = msg.role === "user";

  if (isUser) {
    return (
      <div className="flex flex-col items-end">
        <div className="max-w-[82%] rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-sm text-primary-foreground shadow-soft break-words">
          {msg.content !== "(file upload)" && <span>{msg.content}</span>}
          {msg.attachments && msg.attachments.length > 0 && (
            <div className="mt-1.5 space-y-1">
              {msg.attachments.map((a) => (
                <FileAttachmentPill key={a.id} attachment={a} />
              ))}
            </div>
          )}
        </div>
        <span className="mt-1 text-[10px] tabular-nums text-muted-foreground/70">{formatTime(msg.timestamp)}</span>
      </div>
    );
  }

  return (
    <AetherisFrame time={formatTime(msg.timestamp)}>
      <ChatMessageContent msg={msg} data={data} onUndo={onUndo ? () => onUndo(msg.id) : undefined} />
    </AetherisFrame>
  );
});

// ─── File attachment pill ─────────────────────────────────────────────────────

function FileAttachmentPill({ attachment }: { attachment: FileAttachment }) {
  const kindIcons: Record<string, string> = { image: "🖼", spreadsheet: "📊", json: "📋", calendar: "📅", text: "📄", other: "📎" };
  const label = `${kindIcons[attachment.kind] ?? "📎"} ${attachment.name}`;

  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-primary-foreground/20 bg-primary-foreground/10 px-2 py-1 text-[11px] leading-none">
      <span className="truncate">{label}</span>
      <span className="text-[9px] opacity-60 num shrink-0">({(attachment.size / 1024).toFixed(0)}KB)</span>
    </div>
  );
}

// ─── Export ──────────────────────────────────────────────────────────────────

export default function ChatThread({
  messages,
  loading,
  streamingText,
  onUndo,
  data,
}: {
  messages: ChatMessage[];
  loading: boolean;
  streamingText: string | null;
  onUndo?: (messageId: string) => void;
  data?: ScheduleData;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0 && !loading) return null;

  return (
    <div className="px-4 py-4 space-y-5">
      {messages.map((msg) => (
        <MessageRow key={msg.id} msg={msg} data={data} onUndo={onUndo} />
      ))}

      {loading && streamingText && (
        <AetherisFrame>
          <ChatMarkdown text={streamingText} data={data} />
          <span className="inline-block h-3.5 w-0.5 ml-0.5 align-middle bg-secondary/70 animate-pulse motion-reduce:animate-none" />
        </AetherisFrame>
      )}

      {loading && !streamingText && (
        <AetherisFrame>
          <ThinkingDots />
        </AetherisFrame>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
