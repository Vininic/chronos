import { useRef, useEffect } from "react";
import type { ChatMessage } from "@/lib/ai/chat/store";
import { Brain, CheckCircle2, AlertCircle, Undo2, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

function formatTime(ts: string) {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function MarkdownBlock({ text }: { text: string }) {
  const lines = text.split("\n");
  const elements: JSX.Element[] = [];
  let inList = false;

  lines.forEach((line, i) => {
    const trimmed = line.trim();

    if (!trimmed) {
      if (inList) inList = false;
      elements.push(<div key={i} className="h-2" />);
      return;
    }

    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      inList = true;
      elements.push(
        <li key={i} className="text-sm text-primary/90 ml-4 list-disc">
          {trimmed.slice(2)}
        </li>,
      );
      return;
    }

    if (/^\d+\.\s/.test(trimmed)) {
      inList = false;
      elements.push(
        <li key={i} className="text-sm text-primary/90 ml-4 list-decimal">
          {trimmed.replace(/^\d+\.\s/, "")}
        </li>,
      );
      return;
    }

    if (inList) inList = false;

    const bold = trimmed.replace(/\*\*(.*?)\*\*/g, '<strong class="text-primary font-semibold">$1</strong>');
    elements.push(
      <p key={i} className="text-sm text-primary/90 leading-relaxed" dangerouslySetInnerHTML={{ __html: bold }} />,
    );
  });

  return <div className="space-y-0.5">{elements}</div>;
}

function ToolCallBadge({ call }: { call: NonNullable<ChatMessage["toolCalls"]>[number] }) {
  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] ${
      call.undone
        ? "bg-amber-500/10 text-amber-600"
        : call.error
          ? "bg-red-500/10 text-red-600"
          : "bg-emerald-500/10 text-emerald-600"
    }`}>
      {call.undone ? (
        <Undo2 className="h-3 w-3" />
      ) : call.error ? (
        <AlertCircle className="h-3 w-3" />
      ) : (
        <CheckCircle2 className="h-3 w-3" />
      )}
      <span className="font-mono">{call.tool}</span>
      {call.undone && <span className="text-[10px] opacity-70">undone</span>}
    </div>
  );
}

export default function ChatThread({
  messages,
  loading,
  streamingText,
  onUndo,
}: {
  messages: ChatMessage[];
  loading: boolean;
  streamingText: string | null;
  onUndo?: (messageId: string) => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  if (messages.length === 0 && !loading) {
    return null;
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
      {messages.map((msg) => {
        const isUser = msg.role === "user";
        return (
          <div key={msg.id} className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
            <div className={`h-8 w-8 rounded-full grid place-items-center shrink-0 ${
              isUser
                ? "bg-primary text-primary-foreground"
                : "bg-secondary/20 text-secondary"
            }`}>
              {isUser ? (
                <span className="text-xs font-semibold">U</span>
              ) : (
                <Brain className="h-4 w-4" />
              )}
            </div>
            <div className={`max-w-[80%] ${isUser ? "items-end" : "items-start"}`}>
              <div className={`rounded-2xl px-4 py-2.5 ${
                isUser
                  ? "bg-primary text-primary-foreground rounded-tr-md"
                  : "bg-secondary/10 text-primary rounded-tl-md"
              }`}>
                {isUser ? (
                  <p className="text-sm">{msg.content}</p>
                ) : (
                  <MarkdownBlock text={msg.content} />
                )}
              </div>
              {msg.toolCalls && msg.toolCalls.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {msg.toolCalls.map((tc, idx) => (
                    <ToolCallBadge key={idx} call={tc} />
                  ))}
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
      })}

      {loading && streamingText && (
        <div className="flex gap-3">
          <div className="h-8 w-8 rounded-full bg-secondary/20 grid place-items-center shrink-0">
            <Brain className="h-4 w-4 text-secondary" />
          </div>
          <div className="bg-secondary/10 rounded-2xl rounded-tl-md px-4 py-2.5 max-w-[80%]">
            <MarkdownBlock text={streamingText} />
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
