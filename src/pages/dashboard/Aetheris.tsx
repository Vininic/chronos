import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useT, useI18n } from "@/lib/i18n/I18nProvider";
import { generateDailyBriefing } from "@/lib/ai/briefing/generate";
import { isNewDay, setLastVisitDate } from "@/lib/ai/briefing/store";
import { addAuditEntry, describeToolCall } from "@/lib/ai/audit/store";
import { pendingRegeneration } from "@/lib/ai/tools/regenerateTools";
import { regenerateDays } from "@/lib/ai/planner/refine";
import { useSchedule } from "@/lib/schedule/store";
import { runAetherisPipeline, type AetherisPipelineResult } from "@/lib/ai/core/pipeline";
import type { Insight, Suggestion, RecoveryAnalysis } from "@/lib/ai/core/schemas";
import type { OptimizationResult } from "@/lib/ai/optimization/optimizationEngine";
import { useChatStore, type ChatMessage } from "@/lib/ai/chat/store";
import { streamChatMessage, extractToolCalls, stripToolCallsFromText } from "@/lib/ai/chat/service";
import { globalToolRegistry, registerAllTools } from "@/lib/ai/tools";
import { getProviderRegistration } from "@/lib/ai/core/registry";
import { loadSettingsSync } from "@/lib/ai/settings/store";
import {
  Sparkles, Brain, Coffee, Target, AlertTriangle, Check, ChevronDown, ChevronUp,
  Loader2, MessageSquare, Send, BarChart3, Plus, Trash2, PanelRightOpen, PanelRightClose,
  Clock, ListTodo, History, Undo2, ThumbsUp, ThumbsDown, Bell, CalendarDays,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { ScheduleData } from "@/lib/schedule/types";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import LearningInsights from "@/components/planner/LearningInsights";
import { useLearningProfile } from "@/lib/ai/learning/store";
import type { RejectedSuggestion } from "@/lib/ai/learning/types";
import { extractPreferences, stripPreferenceTags } from "@/lib/ai/memory";
import { getSuggestionFeedback, recordSuggestionFeedback } from "@/lib/ai/metrics/store";
import WelcomeScreen from "@/components/chat/WelcomeScreen";
import ChatThread from "@/components/chat/ChatThread";
import DemoTour from "@/components/chat/DemoTour";
import ProactivePanel, { getProactiveCount, buildDigest } from "@/components/dashboard/ProactivePanel";
import SuggestionFeedbackDialog from "@/components/chat/SuggestionFeedbackDialog";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { setAetherisCount } from "@/lib/notification-count";

type TabView = "insights" | "optimize" | "proactive" | "learning";

export default function Aetheris() {
  const { data, replace, applySuggestion, deferSuggestion } = useSchedule();
  const { profile, addPreferences, rejectSuggestion } = useLearningProfile();
  const t = useT();
  const { locale } = useI18n();

  const {
    sessions, activeSessionId, activeSession,
    createSession, setActiveSession, deleteSession, renameSession,
    addMessage, updateMessage, addToolCall, undoLastToolCall,
  } = useChatStore();

  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [expandedRecovery, setExpandedRecovery] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [tab, setTab] = useState<TabView>("insights");
  const [feedbackTarget, setFeedbackTarget] = useState<Suggestion | null>(null);

  const [pipeline, setPipeline] = useState<AetherisPipelineResult | null>(null);
  const [pipelineLoading, setPipelineLoading] = useState(true);

  // Ref to always have latest data available in mutator closures
  const dataRef = useRef(data);
  dataRef.current = data;

  // Stable mutator implementations that read from dataRef at call time
  const mutatorsRef = useRef({
    addRoutine: (b: Record<string, unknown>): string | null => {
      const id = `r-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const cur = dataRef.current;
      const start = b.start as string;
      const end = b.end as string;
      replace({
        ...cur,
        routine: [...cur.routine, {
          id, day: (b.day ?? 0) as number, start, end,
          kind: (b.kind ?? b.category) as string,
          title: b.title as string, notes: (b.notes as string) ?? "",
          endsNextDay: end <= start,
        }],
      });
      return id;
    },
    updateRoutine: (id: string, patch: Record<string, unknown>): string | null => {
      const cur = dataRef.current;
      replace({ ...cur, routine: cur.routine.map((r) => r.id === id ? { ...r, ...patch } : r) });
      return null;
    },
    removeRoutine: (id: string) => {
      const cur = dataRef.current;
      replace({ ...cur, routine: cur.routine.filter((r) => r.id !== id) });
    },
    addCommitment: (c: Record<string, unknown>): string | null => {
      const id = `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const cur = dataRef.current;
      const end = c.end as string;
      const start = c.start as string;
      replace({
        ...cur,
        commitments: [...cur.commitments, {
          id, title: c.title as string, start, end,
          kind: (c.category ?? c.kind) as string,
          day: (c.day ?? 0) as number, date: c.date as string | undefined,
          notes: (c.notes as string) ?? "",
          endsNextDay: end <= start,
        }],
      });
      return id;
    },
    removeCommitment: (id: string) => {
      const cur = dataRef.current;
      replace({ ...cur, commitments: cur.commitments.filter((c) => c.id !== id) });
    },
    updateCommitment: (id: string, patch: Record<string, unknown>): string | null => {
      const cur = dataRef.current;
      replace({ ...cur, commitments: cur.commitments.map((c) => c.id === id ? { ...c, ...patch } : c) });
      return null;
    },
    addGoal: (g: Record<string, unknown>): string => {
      const id = `g-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const cur = dataRef.current;
      replace({
        ...cur,
        goals: [...cur.goals, {
          id, kind: (g.kind as string) ?? "numeric",
          tracking: (g.tracking as string) ?? "category",
          title: g.title as string, categoryId: g.categoryId as string | undefined,
          target: (g.target as number) ?? 1, period: (g.period as string) ?? "weekly",
          startDate: (g.startDate as string) ?? new Date().toISOString().slice(0, 10),
          weight: (g.weight as number) ?? 1, color: g.color as string | undefined,
          description: g.description as string | undefined,
          deadline: g.deadline as string | undefined,
          blocks: [], subTasks: [], looseCommitmentIds: [],
          createdAt: new Date().toISOString(),
        }],
      });
      return id;
    },
    updateGoal: (id: string, patch: Record<string, unknown>) => {
      const cur = dataRef.current;
      replace({ ...cur, goals: cur.goals.map((g) => g.id === id ? { ...g, ...patch } : g) });
    },
    removeGoal: (id: string) => {
      const cur = dataRef.current;
      replace({ ...cur, goals: cur.goals.filter((g) => g.id !== id) });
    },
    addCategory: (c: Record<string, unknown>) => {
      const cur = dataRef.current;
      replace({
        ...cur,
        categories: [...cur.categories, {
          id: (c.id as string) ?? `cat-${Date.now()}`,
          label: (c.label as string) ?? "",
          tone: (c.tone as string) ?? "neutral",
          description: (c.description as string) ?? "",
        }],
      });
    },
    updateCategory: (id: string, patch: Record<string, unknown>) => {
      const cur = dataRef.current;
      replace({ ...cur, categories: cur.categories.map((c) => c.id === id ? { ...c, ...patch } : c) });
    },
    removeCategory: (id: string) => {
      const cur = dataRef.current;
      replace({ ...cur, categories: cur.categories.filter((c) => c.id !== id) });
    },
  });

  // Register tools once (the mutators read from dataRef at call time)
  useEffect(() => {
    registerAllTools(data, mutatorsRef.current);
  }, []);

  // Run pipeline for sidebar display
  const runPipeline = useCallback(async () => {
    setPipelineLoading(true);
    try {
      const result = await runAetherisPipeline({ data });
      setPipeline(result);
    } catch {
      setPipeline(null);
    } finally {
      setPipelineLoading(false);
    }
  }, [data.meta.version, data.routine.length, data.commitments.length, data.categories.length]);

  useEffect(() => {
    runPipeline();
  }, [runPipeline]);

  // Blink state for critical insights (replaces toast alerts)
  const blinkInsightIds = useRef(new Set<string>());
  const [blinkingIds, setBlinkingIds] = useState<string[]>([]);
  useEffect(() => {
    if (!pipeline) return;
    const newIds: string[] = [];
    for (const insight of pipeline.response.insights) {
      if (insight.severity !== "critical") continue;
      const key = insight.title + insight.detail;
      if (blinkInsightIds.current.has(key)) continue;
      blinkInsightIds.current.add(key);
      newIds.push(key);
    }
    if (newIds.length > 0) {
      setBlinkingIds((prev) => [...prev, ...newIds]);
      setTimeout(() => setBlinkingIds([]), 1500);
    }
  }, [pipeline]);

  // Sync notification count to sidebar badge
  useEffect(() => {
    if (!pipeline) return;
    setAetherisCount(pipeline.response.insights.length + pipeline.suggestions.length);
  }, [pipeline]);

  // Ensure a session exists
  useEffect(() => {
    if (sessions.length === 0) {
      createSession("Chat with Aetheris");
    }
  }, [sessions.length]);

  // Daily briefing on first visit each day
  const hasBriefed = useRef(false);
  useEffect(() => {
    if (isNewDay() && activeSessionId && !hasBriefed.current) {
      hasBriefed.current = true;
      const today = new Date().toISOString().slice(0, 10);
      generateDailyBriefing(data).then((briefing) => {
        addMessage(activeSessionId, { role: "assistant", content: briefing });
        setLastVisitDate(today);
      });
    }
  }, [activeSessionId, data.routine.length]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading || !activeSessionId) return;

    setInput("");
    setLoading(true);
    setStreamingText("");

    addMessage(activeSessionId, { role: "user", content: text });

    let fullResponse = "";

    try {
      const stream = streamChatMessage(data, activeSession.messages, text);
      for await (const chunk of stream) {
        fullResponse += chunk;
        setStreamingText(fullResponse);
      }
    } catch {
      fullResponse = "Sorry, I encountered an error. Please check your AI provider configuration in Settings.";
    }

    // Parse and execute tool calls from the response text
    const toolCalls = extractToolCalls(fullResponse);
    const cleanText = stripToolCallsFromText(fullResponse);

    // Extract and persist user preferences from the response
    const extractedPrefs = extractPreferences(fullResponse);
    if (Object.keys(extractedPrefs).length > 0) {
      addPreferences(extractedPrefs);
    }
    const displayText = stripPreferenceTags(cleanText);

    const toolResults: Array<{ tool: string; params: Record<string, unknown>; result?: Record<string, unknown>; error?: string }> = [];

    const preSnapshot = JSON.parse(JSON.stringify(dataRef.current)) as typeof data;

    for (const call of toolCalls) {
      try {
        const execResult = globalToolRegistry.execute(call.tool, call.params);
        toolResults.push({
          tool: call.tool,
          params: call.params,
          result: execResult.success ? (execResult.data as Record<string, unknown>) : undefined,
          error: execResult.success ? undefined : execResult.error,
        });
      } catch (err) {
        toolResults.push({
          tool: call.tool,
          params: call.params,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }

      addAuditEntry({
        tool: call.tool,
        params: call.params,
        description: describeToolCall(call.tool, call.params),
        scheduleSnapshot: preSnapshot,
        undone: false,
      });
    }

    const finalText = displayText || fullResponse;
    addMessage(activeSessionId, {
      role: "assistant",
      content: finalText,
      toolCalls: toolResults.map((tc) => ({
        tool: tc.tool,
        params: tc.params,
        result: tc.result,
        error: tc.error,
        timestamp: new Date().toISOString(),
      })),
    });

    if (toolResults.length > 0) {
      // Show tooltip hint on first function-calling action
      const FUNC_CALL_HINT_KEY = "chronos.func-call-hint";
      if (!localStorage.getItem(FUNC_CALL_HINT_KEY)) {
        localStorage.setItem(FUNC_CALL_HINT_KEY, "true");
        toast({
          title: "Aetheris can make changes to your schedule",
          description: "You can undo any change using the Undo button next to each action.",
          duration: 6000,
        });
      }

      toast({
        title: `${toolResults.length} change(s) applied`,
        description: toolResults.map((tc) =>
          tc.error ? `${tc.tool}: ${tc.error}` : `${tc.tool}: OK`
        ).join(", "),
      });
    }

    // Handle pending schedule regeneration (iterative refinement)
    const regen = pendingRegeneration.current;
    if (regen) {
      pendingRegeneration.current = null;
      setLoading(true);
      try {
        const merged = await regenerateDays(data, regen.days, regen.instructions);
        if (merged) {
          replace(merged);
          const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
          const labels = regen.days.map((d) => dayNames[d] ?? `Day ${d}`).join(", ");
          addMessage(activeSessionId, {
            role: "assistant",
            content: `✅ Regenerated ${labels} with your instructions. The updated schedule is shown above.`,
          });
        } else {
          addMessage(activeSessionId, {
            role: "assistant",
            content: "I wasn't able to regenerate those days. The AI planner may need an API key configured.",
          });
        }
      } catch {
        addMessage(activeSessionId, {
          role: "assistant",
          content: "Sorry, regeneration failed. Please try again or rephrase your instructions.",
        });
      }
      setLoading(false);
    }

    setStreamingText(null);
    setLoading(false);
  };

  const handleUndo = (messageId: string) => {
    if (activeSessionId) {
      undoLastToolCall(activeSessionId);
      toast({ title: "Last action undone" });
    }
  };

  const handleNewChat = () => {
    createSession("New conversation");
  };

  const handleDeleteSession = (id: string) => {
    deleteSession(id);
    if (sessions.length <= 1) {
      createSession("Chat with Aetheris");
    }
  };

  const handleExamplePrompt = (prompt: string) => {
    setInput(prompt);
  };

  const insights = pipeline?.response?.insights ?? [];
  const suggestions = pipeline?.suggestions ?? [];
  const optimization = pipeline?.optimization ?? { conflicts: [], idleGaps: [], focusFragmentation: 0, routineConsistency: 0, timeAllocation: [], compositionScore: 0, scheduledHours: [] };
  const recoveryIntel = pipeline?.recoveryIntelligence ?? { recoveryScore: 0, sustainableScore: 0, recommendations: [] };
  const summary = pipeline?.response?.summary ?? { status: "unknown" as const, headline: "", keyMetrics: {} };
  const explainability = pipeline?.response?.explainability ?? { reasoning: [], affectedGoals: [], affectedBlocks: [], affectedMetrics: [], expectedImpact: "", confidence: 0 };

  const proactiveCount = useMemo(() => getProactiveCount(data, insights, recoveryIntel, optimization), [data, insights, recoveryIntel, optimization]);

  const providerInfo = useMemo(() => {
    const s = loadSettingsSync();
    const reg = getProviderRegistration(s.providerId);
    const name = reg?.name ?? s.providerId;
    const model = s.models[s.providerId] ?? reg?.defaultModel ?? "";
    return `Powered by ${name}${model ? " · " + model : ""} · AI can make mistakes`;
  }, []);

  const tabs: { key: TabView; label: string; icon: typeof Brain; count: number }[] = [
    { key: "insights", label: "Insights", icon: Brain, count: insights.length + suggestions.length },
    { key: "optimize", label: "Optimize", icon: Target, count: optimization.conflicts.length + optimization.idleGaps.length },
    { key: "proactive", label: "Proactive", icon: Bell, count: proactiveCount },
    { key: "learning", label: "Learning", icon: MessageSquare, count: 0 },
  ];

  return (
    <>
      <style dangerouslySetInnerHTML={{__html:`@keyframes alert-blink{0%,100%{opacity:1}50%{opacity:0.3;background-color:rgba(239,68,68,0.08)}}.animate-alert-blink{animation:alert-blink 0.4s ease-in-out 3}`}} />
      <style>{`html,body{overflow-x:hidden;width:100%;}`}</style>
      <div className="flex h-full bg-background overflow-hidden">
      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border shrink-0">
          <div className="flex items-center gap-1 min-w-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 bg-transparent text-sm font-medium text-primary focus:outline-none truncate max-w-[200px] px-1.5 py-1 rounded-md hover:bg-secondary/10 transition-colors">
                  <MessageSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate">{activeSession?.title ?? "Chat with Aetheris"}</span>
                  <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                <DropdownMenuItem onSelect={handleNewChat} className="gap-2 cursor-pointer text-xs">
                  <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">New chat</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-normal">
                  {sessions.length} {sessions.length === 1 ? "conversation" : "conversations"}
                </DropdownMenuLabel>
                {sessions.map((s) => (
                  <DropdownMenuItem
                    key={s.id}
                    onSelect={() => setActiveSession(s.id)}
                    className={`gap-2 text-xs cursor-pointer ${
                      s.id === activeSessionId ? "bg-accent" : ""
                    }`}
                  >
                    <MessageSquare className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="flex-1 truncate">{s.title}</span>
                    <span className="text-[9px] text-muted-foreground/50 num shrink-0">{s.messages.length}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteSession(s.id); }}
                      className="h-5 w-5 rounded hover:bg-destructive/10 grid place-items-center text-muted-foreground/40 hover:text-destructive transition-colors ml-auto shrink-0"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="h-7 px-2 rounded-md text-xs text-muted-foreground hover:text-primary hover:bg-secondary/10 transition-colors flex items-center gap-1"
            >
              {showSidebar ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRightOpen className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{showSidebar ? "Hide" : "Show"} panel</span>
            </button>
          </div>
        </div>

        {/* Messages */}
        {activeSession && activeSession.messages.length === 0 && !loading ? (
          <WelcomeScreen onPromptClick={handleExamplePrompt} />
        ) : (
          <ChatThread
            messages={activeSession?.messages ?? []}
            loading={loading}
            streamingText={streamingText}
            onUndo={handleUndo}
          />
        )}

        {/* Input */}
        <div className="px-4 pb-3 pt-2">
          <div className="rounded-2xl border border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-sm">
            <div className="flex gap-1.5 px-3 pt-2 pb-1 overflow-x-auto">
              {[
                { icon: Brain, label: "Analyze", prompt: "Analyze my schedule for this week." },
                { icon: Coffee, label: "Recovery", prompt: "What's my recovery score?" },
                { icon: Target, label: "Optimize", prompt: "Help me optimize my day." },
                { icon: Sparkles, label: "Suggest", prompt: "Suggest blocks I should add to my schedule." },
              ].map((chip) => (
                <button
                  key={chip.label}
                  onClick={() => setInput(chip.prompt)}
                  className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary px-2 py-1 rounded-full border border-border/50 hover:border-secondary/30 transition-colors shrink-0"
                >
                  <chip.icon className="h-3 w-3" />
                  {chip.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 px-3 py-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Ask Aetheris about your schedule..."
                disabled={loading}
                className="flex-1 bg-transparent text-sm text-primary placeholder:text-muted-foreground/50 focus:outline-none disabled:opacity-50"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || loading}
                className="h-8 w-8 rounded-md bg-primary grid place-items-center text-primary-foreground disabled:opacity-30 hover:bg-primary-deep transition-colors shrink-0"
              >
                {loading ? (
                  <span className="h-3.5 w-3.5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>
          <div className="flex items-center justify-center gap-2 mt-2">
            <span className="text-[9px] text-muted-foreground/30">Chronos · by Vinicius</span>
            <span className="text-[9px] text-muted-foreground/20">|</span>
            <span className="text-[9px] text-muted-foreground/40">{providerInfo}</span>
          </div>
        </div>
      </div>

      {/* Tour overlay */}
      <DemoTour />

      {/* Right sidebar */}
      <div className={`overflow-x-hidden transition-all duration-300 ease-in-out hidden lg:block ${
        showSidebar ? "w-80 opacity-100 border-l border-border" : "w-0 opacity-0"
      }`}>
          <div className="w-80 shrink-0 overflow-x-hidden bg-background h-full min-w-0">
          <div className="p-4 overflow-y-auto overflow-x-hidden">
            {/* Tab bar */}
            <div className="flex flex-wrap gap-1 mb-4">
              {tabs.map((tabDef) => (
                <button
                  key={tabDef.key}
                  onClick={() => setTab(tabDef.key)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-wider rounded-md transition-colors ${
                    tab === tabDef.key
                      ? "bg-secondary/20 text-secondary"
                      : "text-muted-foreground hover:text-primary hover:bg-secondary/5"
                  }`}
                >
                  <tabDef.icon className="h-3 w-3" />
                  {tabDef.label}
                  {tabDef.count > 0 && (
                    <span className="text-[9px] bg-secondary/30 text-secondary px-1 rounded-full">{tabDef.count}</span>
                  )}
                </button>
              ))}
            </div>

            {/* Tab panels */}
            {tab === "insights" && (
              <div className="space-y-3">
                {pipelineLoading ? (
                  <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-secondary" /></div>
                ) : insights.length === 0 && suggestions.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No issues detected</p>
                ) : (
                  <>
                    {/* Today's digest */}
                    <div className="border border-border rounded-lg p-3 bg-gradient-to-br from-secondary/5 to-transparent">
                        <div className="flex items-center gap-2 mb-2">
                          <CalendarDays className="h-4 w-4 text-secondary" />
                          <span className="text-xs font-medium text-primary">{t.chronos.plannerPage.currentPlan ?? "Today's digest"}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">{buildDigest(data)}</p>
                      </div>
                    {insights.filter((i) => {
                      const isRecovery = i.type && ["overload", "burnout_risk", "sleep_debt", "context_switching", "consecutive_work"].includes(i.type);
                      const titleHasRecovery = i.title.toLowerCase().includes("recovery");
                      return !isRecovery && !titleHasRecovery;
                    }).slice(0, 5).map((ins) => (
                      <InsightCard key={ins.title + ins.detail} insight={ins} blinking={blinkingIds.includes(ins.title + ins.detail)} />
                    ))}
                    {suggestions.length > 0 && (
                      <div className="pt-2 border-t border-border/40">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-2 px-0.5">Suggestions</div>
                        {suggestions.slice(0, 5).map((s) => {
                    const vote = getSuggestionFeedback(s.id);
                    return (
                      <div key={s.id} className="border border-border rounded-lg p-3 relative">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-xs font-medium text-primary truncate">{s.title}</div>
                          {s.priority && (
                            <span className={`shrink-0 text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                              s.priority === "high"
                                ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                                : s.priority === "med"
                                ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                                : "bg-muted text-muted-foreground border border-border/50"
                            }`}>
                              {s.priority === "high" ? "Sure" : s.priority === "med" ? "Fair" : "Unsure"}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1">{s.detail}</p>
                        {explainability.reasoning.length > (recoveryIntel.recoveryScore < 50 ? 1 : 0) && (
                          <p className="text-[10px] italic text-muted-foreground/60 mt-1.5 leading-relaxed">
                            {explainability.reasoning.slice(recoveryIntel.recoveryScore < 50 ? 1 : 0, recoveryIntel.recoveryScore < 50 ? 2 : 1).join(" ")}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-2 pt-1.5 border-t border-border/40">
                          <button
                            onClick={() => recordSuggestionFeedback(s.id, "up")}
                            className={`flex items-center gap-1 text-[10px] transition-colors ${
                              vote === "up" ? "text-emerald-500" : "text-muted-foreground/50 hover:text-emerald-500"
                            }`}
                          >
                            <ThumbsUp className="h-3 w-3" />
                          </button>
                          <div className="relative">
                            <button
                              onClick={() => setFeedbackTarget(s)}
                              className={`flex items-center gap-1 text-[10px] transition-colors ${
                                vote === "down" ? "text-red-500" : "text-muted-foreground/50 hover:text-red-500"
                              }`}
                            >
                              <ThumbsDown className="h-3 w-3" />
                            </button>
                            {feedbackTarget?.id === s.id && (
                              <SuggestionFeedbackDialog
                                onSubmit={(reason, notes) => {
                                  recordSuggestionFeedback(s.id, "down");
                                  rejectSuggestion({ id: s.id, type: s.type, title: s.title, detail: s.detail, reason: reason as RejectedSuggestion["reason"], userNotes: notes || undefined });
                                  setFeedbackTarget(null);
                                }}
                                onCancel={() => setFeedbackTarget(null)}
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                      </div>
                    )}
                    {/* Reasoning + Recovery */}
                    <div className="pt-2 border-t border-border/40 mt-2">
                      <div className="text-[10px] uppercase tracking-wider text-secondary mb-2 px-0.5">Reasoning</div>
                      <ul className="space-y-1">
                        {recoveryIntel.recoveryScore < 50 && (
                          <li className="border border-red-400/50 rounded-lg p-3 animate-[glow_2s_ease-in-out_3]">
                            <button
                              onClick={() => setExpandedRecovery(!expandedRecovery)}
                              className="w-full flex items-center justify-between text-left"
                            >
                              <span className="text-[11px] font-medium text-primary">{locale === "pt" ? "Pontuação de recuperação criticamente baixa" : "Recovery score critically low"}</span>
                              <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${expandedRecovery ? "rotate-180" : ""}`} />
                            </button>
                            {expandedRecovery && (
                              <>
                                <div className="mt-1.5 pt-1.5 border-t border-red-400/20" />
                                <p className="text-[11px] text-muted-foreground mt-1.5">{recoveryIntel.recommendations[0] ?? (locale === "pt" ? "Considere adicionar blocos de descanso ou reduzir a intensidade." : "Your recovery score is 0. Consider adding rest blocks or reducing intensity.")}</p>
                              </>
                            )}
                          </li>
                        )}
                        {explainability.reasoning.map((r: string, i: number) => {
                          if (recoveryIntel.recoveryScore < 50 && i === 0) return null;
                          return (
                          <li key={i} className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                            <span className="mt-1.5 h-1 w-1 rounded-full bg-secondary/40 shrink-0" />
                            {r}
                          </li>
                          );
                        })}
                      </ul>
                    </div>
                    {/* Schedule stats */}
                    <div className="border-t border-border/40 mt-3" />
                    <div className="border border-border rounded-lg p-3">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Schedule</div>
                      <dl className="space-y-1.5 text-xs">
                        {[
                          ["Blocks", data.routine.length],
                          ["Commitments", data.commitments.length],
                          ["Categories", data.categories.length],
                          ["Score", `${data.ledger.compositionScore}/100`],
                          ["Cycle", data.meta.cycle.name],
                        ].map(([l, v]) => (
                          <div key={l as string} className="flex items-center justify-between">
                            <dt className="text-muted-foreground">{l}</dt>
                            <dd className="text-primary font-medium num">{v}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  </>
                )}
              </div>
            )}
            {tab === "optimize" && (
              <div className="space-y-3 overflow-x-hidden">
                <div className="grid grid-cols-2 gap-2">
                  <MetricBox label="Conflicts" value={optimization.conflicts.length} />
                  <MetricBox label="Gaps" value={optimization.idleGaps.length} />
                  <MetricBox label="Frag." value={`${Math.round(optimization.focusFragmentation * 100)}%`} />
                  <MetricBox label="Consist." value={`${Math.round(optimization.routineConsistency * 100)}%`} />
                </div>
                <div className="space-y-3">
                {optimization.conflicts.length > 0 && (
                  <div className="pt-2 border-t border-border/40">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-2 px-0.5">Conflict details</div>
                    <div className="space-y-2">
                    {optimization.conflicts.map((c, i) => (
                      <div key={i} className="border border-border rounded-lg p-2.5 mb-2 last:mb-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
                            <span className="text-[11px] font-medium text-primary truncate">
                              {c.type === "sleep_overlap" ? "Sleep overlap" : "Overlap"}
                            </span>
                          </div>
                          <button
                            onClick={() => window.location.href = "/dashboard"}
                            className="text-[9px] text-secondary/70 hover:text-secondary underline underline-offset-2 shrink-0"
                          >
                            View
                          </button>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed break-words">{c.detail}</p>
                      </div>
                    ))}
                    </div>
                  </div>
                )}
                {optimization.idleGaps.length > 0 && (
                  <div className="pt-2 border-t border-border/40">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-2 px-0.5">Idle gaps</div>
                    {optimization.idleGaps.slice(0, 3).map((g, i) => (
                      <div key={i} className="border border-border rounded-lg p-2.5 mb-2 last:mb-0">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="text-[11px] text-primary font-medium">{g.start}–{g.end}</span>
                          <span className="text-[9px] text-muted-foreground/50 num">({Math.round(g.durationMin)}m)</span>
                        </div>
                        {g.suggestion && <p className="text-[10px] text-muted-foreground mt-1 break-words">{g.suggestion}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              </div>
            )}
            {tab === "proactive" && (
              <ProactivePanel
                insights={insights}
                optimization={optimization}
                recoveryIntel={recoveryIntel}
                data={data}
              />
            )}
            {tab === "learning" && (
              <LearningInsights profile={profile} />
            )}
          </div>
        </div>
      </div>
    </div>
    </>
  );
}

function InsightCard({ insight, blinking }: { insight: Insight; blinking?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`border rounded-lg overflow-hidden transition-colors ${
      blinking ? "animate-alert-blink border-red-400 dark:border-red-500" :
      insight.severity === "critical" ? "border-red-300/50 dark:border-red-800/50" :
      insight.severity === "warning" ? "border-amber-300/50 dark:border-amber-800/50" :
      "border-border"
    }`}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-2.5 text-left">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${
            insight.severity === "critical" ? "bg-red-500" :
            insight.severity === "warning" ? "bg-amber-500" : "bg-sky-500"
          }`} />
          <span className="text-xs text-primary truncate">{insight.title}</span>
        </div>
        {open ? <ChevronUp className="h-3 w-3 text-muted-foreground shrink-0" /> : <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />}
      </button>
      {open && (
        <div className="px-2.5 pb-2.5 border-t border-border/60 pt-2">
          <p className="text-[11px] text-muted-foreground">{insight.detail}</p>
        </div>
      )}
    </div>
  );
}

function MetricBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-border rounded-lg p-2.5 text-center">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-display text-sm text-primary mt-0.5 num">{value}</div>
    </div>
  );
}


