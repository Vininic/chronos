import { useRef, useState } from "react";
import type { ScheduleData } from "@/lib/schedule/types";
import type { ChatMessage } from "@/lib/ai/chat/store";
import { streamChatMessage, extractToolCalls, stripToolCallsFromText } from "@/lib/ai/chat/service";
import { applyDraftToolCall } from "@/lib/ai/tools/draftExecutor";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { Button } from "@/components/ui/button";
import { Send, Sparkles, Loader2, Check, AlertCircle } from "lucide-react";

/** Visual chat that personalizes the DRAFT — never the live store. The model
 *  sees the current draft as context; any tool calls it emits are applied to a
 *  local copy via `applyDraftToolCall` and surfaced back through `onDraftChange`.
 *  Apply (in the parent) is what finally commits everything. */
export default function PlannerDraftChat({
  draft,
  onDraftChange,
}: {
  draft: ScheduleData;
  onDraftChange: (next: ScheduleData) => void;
}) {
  const { locale } = useI18n();
  const isPt = locale === "pt";
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [liveText, setLiveText] = useState("");
  // Always read the freshest draft when applying tool calls, even across awaits.
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const suggestions = isPt
    ? ["Deixe as terças mais leves", "Academia seg/qua/sex às 7h", "Foco profundo de manhã"]
    : ["Make Tuesdays lighter", "Gym Mon/Wed/Fri at 7am", "Deep work in the mornings"];

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`, role: "user", content: trimmed, timestamp: new Date().toISOString(),
    };
    const history = messages;
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setStreaming(true);
    setLiveText("");

    let full = "";
    try {
      for await (const chunk of streamChatMessage(draftRef.current, history, trimmed)) {
        full += chunk;
        setLiveText(stripToolCallsFromText(full));
      }
    } catch {
      full += isPt ? "\n(Erro ao processar.)" : "\n(Error processing.)";
    }

    // Apply any tool calls to the draft, in order, threading the result.
    const calls = extractToolCalls(full);
    const applied: ChatMessage["toolCalls"] = [];
    let working = draftRef.current;
    for (const call of calls) {
      const res = applyDraftToolCall(working, call.tool, call.params);
      applied.push({
        tool: call.tool,
        params: call.params,
        result: res.ok ? { message: res.message } : undefined,
        error: res.error,
        timestamp: new Date().toISOString(),
      });
      if (res.ok) working = res.draft;
    }
    if (working !== draftRef.current) onDraftChange(working);

    const assistantMsg: ChatMessage = {
      id: `a-${Date.now()}`,
      role: "assistant",
      content: stripToolCallsFromText(full) || (applied.length ? (isPt ? "Pronto." : "Done.") : ""),
      timestamp: new Date().toISOString(),
      toolCalls: applied.length ? applied : undefined,
    };
    setMessages((m) => [...m, assistantMsg]);
    setLiveText("");
    setStreaming(false);
  }

  return (
    <div className="flex flex-col h-full min-h-[20rem]">
      <div className="flex items-center gap-1.5 mb-3 text-sm font-medium text-primary">
        <Sparkles className="h-4 w-4 text-secondary" />
        {isPt ? "Personalizar por conversa" : "Personalize via chat"}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto pr-1">
        {messages.length === 0 && !streaming && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {isPt
                ? "Descreva ajustes em linguagem natural — eles entram no rascunho, não na sua agenda."
                : "Describe tweaks in plain language — they land in the draft, not your live schedule."}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-[11px] px-2.5 py-1 rounded-full border border-border text-muted-foreground hover:border-secondary/50 hover:text-primary transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={m.role === "user" ? "text-right" : "text-left"}>
            {m.content && (
              <div
                className={`inline-block max-w-[90%] text-xs rounded-lg px-3 py-2 text-left ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 text-foreground"
                }`}
              >
                {m.content}
              </div>
            )}
            {m.toolCalls?.map((tc, i) => (
              <div
                key={i}
                className={`mt-1 inline-flex items-center gap-1.5 text-[11px] rounded-md px-2 py-1 ${
                  tc.error
                    ? "bg-rose-500/10 text-rose-500"
                    : "bg-emerald-500/10 text-emerald-500"
                }`}
              >
                {tc.error ? <AlertCircle className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                <span className="font-medium">{tc.tool}</span>
                <span className="opacity-80">
                  {tc.error ?? (tc.result?.message as string | undefined) ?? "ok"}
                </span>
              </div>
            ))}
          </div>
        ))}

        {streaming && (
          <div className="text-left">
            <div className="inline-flex items-center gap-2 max-w-[90%] text-xs rounded-lg px-3 py-2 bg-muted/50 text-muted-foreground">
              {!liveText && <Loader2 className="h-3 w-3 animate-spin" />}
              {liveText || (isPt ? "Pensando…" : "Thinking…")}
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        className="mt-3 flex items-center gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={streaming}
          placeholder={isPt ? "Peça um ajuste…" : "Ask for a tweak…"}
          className="flex-1 h-9 rounded-lg border border-border bg-background px-3 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-secondary/50"
        />
        <Button type="submit" size="sm" disabled={streaming || !input.trim()} className="h-9">
          <Send className="h-3.5 w-3.5" />
        </Button>
      </form>
    </div>
  );
}
