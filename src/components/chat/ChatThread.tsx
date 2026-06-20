import { useRef, useEffect, useMemo, memo } from "react";
import type { ChatMessage } from "@/lib/ai/chat/store";
import type { ScheduleData } from "@/lib/schedule/types";
import {
  Brain, CheckCircle2, AlertCircle, Undo2, Loader2, Clock,
} from "lucide-react";
import { BlockPill, BlockBadge, BlockSection, extractBlockData, ACTIONS_HEADER_RE } from "./BlockPill";

// ─── Utilities ─────────────────────────────────────────────────────────────

function formatTime(ts: string) {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

// ─── Proposed-action parsing ────────────────────────────────────────────────
// Works purely from text — no block data dependency needed. The AI's "Actions:"
// section is parsed into typed items regardless of whether block titles match
// anything in the schedule, so something visual always appears.

interface ParsedAction {
  kind: "delete" | "create" | "modify";
  label: string;
  start?: string;
  end?: string;
  category?: string;
}

const TIME_RANGE_RE = /(\d{1,2}:\d{2})\s*[–\-]\s*(\d{1,2}:\d{2})/;
const DELETE_VERB_RE  = /^(delete|remove)[d]?\s*[:\s]\s*/i;
const CREATE_VERB_RE  = /^(create|add)[d]?\s*[:\s]\s*/i;
const MODIFY_VERB_RE  = /^(move|update|modify|merge|split|reschedule|change)\w*\s*[:\s]\s*/i;
const REMOVED_VERB_RE = /^(removed|deleted)\s*[:\s]\s*/i;
const ADDED_VERB_RE   = /^(added|created)\s*[:\s]\s*/i;
const MODIFIED_VERB_RE = /^(modified|moved|updated|merged|split)\s*[:\s]\s*/i;
const BULLET_RE = /^[-•*]\s+(.+)$|^\d+\.\s+(.+)$/;
const WRITE_TOOLS = new Set(["createBlock","updateBlock","deleteBlock","moveBlock","splitBlock","mergeBlocks","addCommitment","removeCommitment","updateCommitment"]);

// Splits a comma-separated list ignoring commas inside parentheses.
function splitOutsideParens(text: string): string[] {
  const parts: string[] = [];
  let depth = 0, start = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')') depth--;
    else if (depth === 0 && text[i] === ',') { parts.push(text.slice(start, i).trim()); start = i + 1; }
  }
  parts.push(text.slice(start).trim());
  return parts.map(p => p.replace(/^\s*and\s+/i, '').trim()).filter(Boolean);
}

function extractItems(text: string, kind: ParsedAction["kind"]): ParsedAction[] {
  const out: ParsedAction[] = [];

  // 1. Quoted names: "Title" [from] HH:MM-HH:MM
  const quotedRE = /"([^"]+)"/g;
  let m: RegExpExecArray | null;
  let foundQuoted = false;
  while ((m = quotedRE.exec(text)) !== null) {
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 60);
    const t = TIME_RANGE_RE.exec(after);
    out.push({ kind, label: m[1], start: t?.[1], end: t?.[2] });
    foundQuoted = true;
  }
  if (foundQuoted) return out;

  // 2. Comma-separated items outside parens: "A, B, Strategy (note)" → ["A","B","Strategy"]
  const outerParts = splitOutsideParens(text.replace(/[.!]$/, ''));
  if (outerParts.length > 1) {
    for (const part of outerParts) {
      const label = part.replace(/\s*\([^)]*\)\s*$/, '').replace(/[.!]$/, '').trim();
      if (label.length > 2) {
        const t = TIME_RANGE_RE.exec(part);
        out.push({ kind, label, start: t?.[1], end: t?.[2] });
      }
    }
    if (out.length > 0) return out;
  }

  // 3. Paren IS the list: "Redundant blocks (A, B, and C)"
  const parenMatch = /\(([^)]+)\)/.exec(text);
  if (parenMatch && parenMatch[1].includes(',')) {
    const items = parenMatch[1].split(/,\s+(?:and\s+)?|(?:\s+and\s+)/i);
    for (const item of items) {
      const label = item.trim().replace(/[.!]$/, '');
      if (label.length > 2) out.push({ kind, label });
    }
    if (out.length > 0) return out;
  }

  // 4. Fallback: entire text as a single item
  const cleaned = text.replace(/[.!]$/, '').trim();
  if (cleaned.length > 2) {
    const t = TIME_RANGE_RE.exec(cleaned);
    out.push({
      kind,
      label: cleaned.replace(TIME_RANGE_RE, '').replace(/\bfrom\b/i, '').trim(),
      start: t?.[1],
      end: t?.[2],
    });
  }
  return out;
}

export function parseActionsSection(content: string): ParsedAction[] {
  const headerIdx = content.search(ACTIONS_HEADER_RE);
  if (headerIdx === -1) return [];

  const lines = content.slice(headerIdx).split('\n');
  const actions: ParsedAction[] = [];
  let currentKind: ParsedAction["kind"] | null = null;
  let pastHeader = false;

  for (const rawLine of lines) {
    const line = rawLine.trim().replace(/\*\*/g, '').trim();
    if (!line) continue;
    if (ACTIONS_HEADER_RE.test(rawLine)) { pastHeader = true; continue; }
    if (!pastHeader) continue;

    const tryKind = (re: RegExp, kind: ParsedAction["kind"]): boolean => {
      if (!re.test(line)) return false;
      currentKind = kind;
      const rest = line.replace(re, '').trim();
      if (rest) actions.push(...extractItems(rest, kind));
      return true;
    };

    if (tryKind(DELETE_VERB_RE, "delete")) continue;
    if (tryKind(CREATE_VERB_RE, "create")) continue;
    if (tryKind(MODIFY_VERB_RE, "modify")) continue;
    if (tryKind(REMOVED_VERB_RE, "delete")) continue;
    if (tryKind(ADDED_VERB_RE, "create")) continue;
    if (tryKind(MODIFIED_VERB_RE, "modify")) continue;

    // Bullet/numbered items — infer kind from item text, or inherit currentKind
    const bulletMatch = BULLET_RE.exec(line);
    if (bulletMatch) {
      const itemText = bulletMatch[1] ?? bulletMatch[2] ?? '';
      if (itemText) {
        let bulletKind = currentKind;
        let content = itemText;
        if      (DELETE_VERB_RE.test(itemText))   { bulletKind = "delete"; content = itemText.replace(DELETE_VERB_RE, '').trim(); }
        else if (REMOVED_VERB_RE.test(itemText))  { bulletKind = "delete"; content = itemText.replace(REMOVED_VERB_RE, '').trim(); }
        else if (CREATE_VERB_RE.test(itemText))   { bulletKind = "create"; content = itemText.replace(CREATE_VERB_RE, '').trim(); }
        else if (ADDED_VERB_RE.test(itemText))    { bulletKind = "create"; content = itemText.replace(ADDED_VERB_RE, '').trim(); }
        else if (MODIFY_VERB_RE.test(itemText))   { bulletKind = "modify"; content = itemText.replace(MODIFY_VERB_RE, '').trim(); }
        else if (MODIFIED_VERB_RE.test(itemText)) { bulletKind = "modify"; content = itemText.replace(MODIFIED_VERB_RE, '').trim(); }
        if (bulletKind && content) actions.push(...extractItems(content, bulletKind));
      }
      continue;
    }

    // Non-action line → closing text starts here, stop
    break;
  }

  return actions;
}

// ─── Inline renderer ────────────────────────────────────────────────────────

function renderInline(
  text: string,
  blockByTitle: Map<string, { kind: string }>,
  categories: ScheduleData["categories"] | undefined,
): (JSX.Element | null)[] {
  const parts = text.split(/"([^"]+)"/);
  return parts.map((part, i) => {
    if (i % 2 === 0) {
      if (!part) return null;
      const html = part.replace(/\*\*(.*?)\*\*/g, '<strong class="text-primary font-semibold">$1</strong>');
      return <span key={i} dangerouslySetInnerHTML={{ __html: html }} />;
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

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) { elements.push(<div key={i} className="h-1.5" />); return; }

    // Horizontal rule
    if (/^---+$/.test(trimmed)) {
      elements.push(<hr key={i} className="border-border/50 my-1" />);
      return;
    }

    // Headings (## and ###)
    if (trimmed.startsWith("### ")) {
      const text = trimmed.slice(4);
      elements.push(
        <p key={i} className="text-xs font-semibold text-primary/80 uppercase tracking-wider mt-2 mb-0.5">
          {renderInline(text, blockByTitle, data?.categories)}
        </p>
      );
      return;
    }
    if (trimmed.startsWith("## ")) {
      const text = trimmed.slice(3);
      elements.push(
        <p key={i} className="text-sm font-semibold text-primary mt-2 mb-0.5">
          {renderInline(text, blockByTitle, data?.categories)}
        </p>
      );
      return;
    }

    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      elements.push(
        <li key={i} className="text-sm text-primary/90 ml-4 list-disc">
          {renderInline(trimmed.slice(2), blockByTitle, data?.categories)}
        </li>
      );
      return;
    }
    if (/^\d+\.\s/.test(trimmed)) {
      elements.push(
        <li key={i} className="text-sm text-primary/90 ml-4 list-decimal">
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

  return <div className="space-y-0.5">{elements}</div>;
}

// ─── Tool call badge ─────────────────────────────────────────────────────────

function ToolCallBadge({ call }: { call: NonNullable<ChatMessage["toolCalls"]>[number] }) {
  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] ${
      call.undone ? "bg-amber-500/10 text-amber-600"
        : call.error ? "bg-red-500/10 text-red-600"
        : "bg-emerald-500/10 text-emerald-600"
    }`}>
      {call.undone ? <Undo2 className="h-3 w-3" />
        : call.error ? <AlertCircle className="h-3 w-3" />
        : <CheckCircle2 className="h-3 w-3" />}
      <span className="font-mono">{call.tool}</span>
      {call.undone && <span className="text-[10px] opacity-70">undone</span>}
    </div>
  );
}

// ─── Confirmed change pills ──────────────────────────────────────────────────

function ScheduleVisuals({ blocks }: { blocks: ReturnType<typeof extractBlockData> }) {
  if (blocks.length === 0) return null;
  const added    = blocks.filter(b => b.action === "added");
  const removed  = blocks.filter(b => b.action === "removed");
  const modified = blocks.filter(b => b.action === "modified");
  return (
    <div className="mt-2 space-y-2">
      {added.length > 0 && (
        <BlockSection title="Added" icon={<CheckCircle2 className="h-3 w-3 text-emerald-500" />}
          items={added.map((b, i) => <BlockPill key={i} {...b} />)} />
      )}
      {removed.length > 0 && (
        <BlockSection title="Removed" icon={<AlertCircle className="h-3 w-3 text-red-400" />}
          items={removed.map((b, i) => <BlockPill key={i} {...b} />)} />
      )}
      {modified.length > 0 && (
        <BlockSection title="Modified" icon={<Undo2 className="h-3 w-3 text-amber-500" />}
          items={modified.map((b, i) => <BlockPill key={i} {...b} />)} />
      )}
    </div>
  );
}

// ─── Proposed actions card ───────────────────────────────────────────────────
// Shown when the AI describes what it plans to do but hasn't executed yet.
// Renders purely from text — no schedule data dependency for visual output.

function ActionsCard({
  actions,
  rawText,
  categories,
}: {
  actions: ParsedAction[];
  rawText?: string;
  categories?: ScheduleData["categories"];
}) {
  if (actions.length === 0 && !rawText) return null;
  const removed  = actions.filter(a => a.kind === "delete");
  const added    = actions.filter(a => a.kind === "create");
  const modified = actions.filter(a => a.kind === "modify");
  return (
    <div className="mt-2 rounded-xl border border-dashed border-secondary/30 bg-secondary/[0.03] overflow-hidden">
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-dashed border-secondary/20 bg-secondary/[0.04]">
        <Clock className="h-3 w-3 text-secondary/70" />
        <span className="text-[10px] uppercase tracking-wider text-secondary/70 font-medium">Proposed</span>
      </div>
      {actions.length === 0 && rawText ? (
        <div className="px-3 py-2.5 text-[11px] text-primary/60 whitespace-pre-wrap leading-relaxed">{rawText}</div>
      ) : (
        <div className="px-3 py-2.5 space-y-2.5">
          {removed.length > 0 && (
            <BlockSection
              title="Remove"
              icon={<AlertCircle className="h-3 w-3 text-red-400" />}
              items={removed.map((a, i) => (
                <BlockPill key={i} title={a.label} start={a.start} end={a.end} kind={a.category} categories={categories} action="removed" />
              ))}
            />
          )}
          {added.length > 0 && (
            <BlockSection
              title="Add"
              icon={<CheckCircle2 className="h-3 w-3 text-emerald-500" />}
              items={added.map((a, i) => (
                <BlockPill key={i} title={a.label} start={a.start} end={a.end} kind={a.category} categories={categories} action="added" />
              ))}
            />
          )}
          {modified.length > 0 && (
            <BlockSection
              title="Modify"
              icon={<Undo2 className="h-3 w-3 text-amber-500" />}
              items={modified.map((a, i) => (
                <BlockPill key={i} title={a.label} start={a.start} end={a.end} kind={a.category} categories={categories} action="modified" />
              ))}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Closing-text detection ──────────────────────────────────────────────────
// Returns true when a line is part of the action list (not closing remarks).

function isActionLine(raw: string): boolean {
  const line = raw.trim().replace(/\*\*/g, '');
  return (
    /^[-•*]\s/.test(line) ||
    /^\d+\.\s/.test(line) ||
    ACTIONS_HEADER_RE.test(raw) ||
    /^(Delete|Remove|Create|Add|Move|Update|Modify|Removed|Added|Created|Deleted|Modified|Merged|Split)[\s:]/i.test(line)
  );
}

// ─── Message content ─────────────────────────────────────────────────────────

function ChatMessageContent({ msg, data }: { msg: ChatMessage; data?: ScheduleData }) {
  const hasWriteCalls = msg.toolCalls?.some(tc => !tc.error && WRITE_TOOLS.has(tc.tool)) ?? false;
  // Only show the actions card when the AI hasn't already executed the changes
  const hasActionsSection = !hasWriteCalls && ACTIONS_HEADER_RE.test(msg.content);

  const confirmedBlocks = useMemo(
    () => (hasWriteCalls ? extractBlockData(msg, data) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [msg.id, msg.toolCalls, data, hasWriteCalls],
  );

  // Split content at "Actions:" — always done when detected so the section never shows as plain text
  const { displayText, actionsRaw, closingText } = useMemo(() => {
    if (!hasActionsSection) return { displayText: msg.content, actionsRaw: "", closingText: "" };

    const idx = msg.content.search(ACTIONS_HEADER_RE);
    const beforeActions = msg.content.slice(0, idx).trim();
    const afterLines = msg.content.slice(idx).split('\n');

    let closingStart = -1;
    let pastHeader = false;
    const actionIdxs: number[] = [];

    for (let i = 0; i < afterLines.length; i++) {
      const line = afterLines[i].trim();
      if (!line) continue;
      if (ACTIONS_HEADER_RE.test(afterLines[i])) { pastHeader = true; continue; }
      if (!pastHeader) continue;
      if (!isActionLine(afterLines[i])) { closingStart = i; break; }
      actionIdxs.push(i);
    }

    return {
      displayText: beforeActions,
      actionsRaw: actionIdxs.map(i => afterLines[i]).join('\n'),
      closingText: closingStart !== -1 ? afterLines.slice(closingStart).join('\n').trim() : '',
    };
  }, [msg.content, hasActionsSection]);

  // Parse for typed items (icons/colors). Falls back to actionsRaw inside ActionsCard if empty.
  const proposedActions = useMemo(
    () => (hasActionsSection ? parseActionsSection(msg.content) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [msg.id, msg.content, hasActionsSection],
  );

  // Enrich with category from matching block titles so BlockPill can color by category
  const enrichedActions = useMemo(() => {
    if (!data || proposedActions.length === 0) return proposedActions;
    const allBlocks = [...(data.routine ?? []), ...(data.commitments ?? [])];
    const byTitle = new Map(allBlocks.map(b => [b.title.toLowerCase(), b.kind]));
    return proposedActions.map(a => ({
      ...a,
      category: a.category ?? byTitle.get(a.label.toLowerCase()),
    }));
  }, [proposedActions, data]);

  return (
    <>
      {displayText && <ChatMarkdown text={displayText} data={data} />}
      {confirmedBlocks.length > 0 && <ScheduleVisuals blocks={confirmedBlocks} />}
      {hasActionsSection && <ActionsCard actions={enrichedActions} rawText={actionsRaw} categories={data?.categories} />}
      {closingText && (
        <div className="mt-2 opacity-75">
          <ChatMarkdown text={closingText} data={data} />
        </div>
      )}
    </>
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
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div className={`h-8 w-8 rounded-full grid place-items-center shrink-0 ${
        isUser ? "bg-primary text-primary-foreground" : "bg-secondary/20 text-secondary"
      }`}>
        {isUser ? <span className="text-xs font-semibold">U</span> : <Brain className="h-4 w-4" />}
      </div>

      <div className={`max-w-[80%] ${isUser ? "items-end" : "items-start"}`}>
        <div className={`rounded-2xl px-4 py-2.5 break-words ${
          isUser
            ? "bg-primary text-primary-foreground rounded-tr-md"
            : msg.toolCalls?.length
              ? "bg-secondary/10 text-primary rounded-tl-md border-l-2 border-secondary/30"
              : "bg-secondary/10 text-primary rounded-tl-md"
        }`}>
          {isUser
            ? <p className="text-sm">{msg.content}</p>
            : <ChatMessageContent msg={msg} data={data} />
          }
        </div>

        {msg.toolCalls && msg.toolCalls.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {msg.toolCalls.map((tc, idx) => <ToolCallBadge key={idx} call={tc} />)}
            {onUndo && (
              <button
                onClick={() => onUndo(msg.id)}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary px-2 py-1 rounded-md border border-border/50 hover:border-secondary/30 transition-colors"
              >
                <Undo2 className="h-3 w-3" />
                Undo
              </button>
            )}
          </div>
        )}

        <div className={`text-[10px] text-muted-foreground mt-1 ${isUser ? "text-right" : ""}`}>
          {formatTime(msg.timestamp)}
        </div>
      </div>
    </div>
  );
});

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
    <div className="px-4 py-4 space-y-3">
      {messages.map((msg) => (
        <MessageRow key={msg.id} msg={msg} data={data} onUndo={onUndo} />
      ))}

      {loading && streamingText && (
        <div className="flex gap-3">
          <div className="h-8 w-8 rounded-full bg-secondary/20 grid place-items-center shrink-0">
            <Brain className="h-4 w-4 text-secondary" />
          </div>
          <div className="bg-secondary/10 rounded-2xl rounded-tl-md px-4 py-2.5 max-w-[80%] break-words">
            <ChatMarkdown text={streamingText} />
            <span className="inline-block w-0.5 h-3.5 bg-secondary/60 ml-0.5 align-middle animate-pulse" />
          </div>
        </div>
      )}

      {loading && !streamingText && (
        <div className="flex gap-3">
          <div className="h-8 w-8 rounded-full bg-secondary/20 grid place-items-center shrink-0">
            <Brain className="h-4 w-4 text-secondary" />
          </div>
          <div className="bg-secondary/10 rounded-2xl rounded-tl-md px-4 py-3">
            <Loader2 className="h-4 w-4 animate-spin text-secondary" />
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
