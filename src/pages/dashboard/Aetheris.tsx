import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useT, useI18n } from "@/lib/i18n/I18nProvider";
import { generateDailyBriefing } from "@/lib/ai/briefing/generate";
import { isNewDay, setLastVisitDate } from "@/lib/ai/briefing/store";
import { addAuditEntry, describeToolCall } from "@/lib/ai/audit/store";
import { pendingRegeneration } from "@/lib/ai/tools/regenerateTools";
import { regenerateDays } from "@/lib/ai/planner/refine";
import { useSchedule } from "@/lib/schedule/store";
import { buildAgendaForDate } from "@/lib/schedule/agenda";
import { timeToMinutes, durationMin, fmtDur } from "@/lib/schedule/types";
import { safeKindStyle } from "@/components/dashboard/widgets";
import { runAetherisPipeline, type AetherisPipelineResult } from "@/lib/ai/core/pipeline";
import type { Insight, Suggestion, RecoveryAnalysis } from "@/lib/ai/core/schemas";
import type { OptimizationResult } from "@/lib/ai/optimization/optimizationEngine";
import { useChatStore, type ChatMessage } from "@/lib/ai/chat/store";
import { streamChatMessage, extractToolCalls, stripToolCallsFromText } from "@/lib/ai/chat/service";
import { globalToolRegistry, registerAllTools } from "@/lib/ai/tools";
import { getProviderRegistration } from "@/lib/ai/core/registry";
import { loadSettingsSync, useAISettings } from "@/lib/ai/settings/store";
import {
  Sparkles, Brain, Coffee, Target, AlertTriangle, ChevronDown, ChevronUp,
  Loader2, MessageSquare, Send, Plus, Trash2, PanelRightOpen, PanelRightClose,
  Clock, ThumbsUp, ThumbsDown, CalendarDays, FileText, Zap, SlidersHorizontal,
  History, BarChart3,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { ScheduleData, Goal } from "@/lib/schedule/types";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { useLearningProfile } from "@/lib/ai/learning/store";
import type { RejectedSuggestion } from "@/lib/ai/learning/types";
import { extractPreferences, stripPreferenceTags } from "@/lib/ai/memory";
import { getSuggestionFeedback, recordSuggestionFeedback } from "@/lib/ai/metrics/store";
import WelcomeScreen from "@/components/chat/WelcomeScreen";
import ChatThread from "@/components/chat/ChatThread";
import DemoTour from "@/components/chat/DemoTour";
import { ReportsPanel } from "@/components/digest/ReportsPanel";
import SuggestionFeedbackDialog from "@/components/chat/SuggestionFeedbackDialog";
import LearningInsights from "@/components/planner/LearningInsights";
import AuditHistory from "./AuditHistory";
import AetherisMetrics from "./AetherisMetrics";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { setAetherisCount } from "@/lib/notification-count";

type TabView = "today" | "analysis" | "reports" | "learning" | "history" | "metrics";

export default function Aetheris() {
  const { data, replace, applySuggestion, deferSuggestion } = useSchedule();
  const { profile, addPreferences, rejectSuggestion } = useLearningProfile();
  const { settings, setAutonomy, setFeatureToggle } = useAISettings();
  const t = useT();
  const { locale } = useI18n();
  const navigate = useNavigate();

  const {
    sessions, activeSessionId, activeSession,
    createSession, setActiveSession, deleteSession, renameSession,
    addMessage, updateMessage, addToolCall, undoLastToolCall,
  } = useChatStore();

  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [showSidebar, setShowSidebar] = useState(true);
  const [tab, setTab] = useState<TabView>("today");
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
          id, kind: ((g.kind as string) ?? "numeric") as Goal["kind"],
          tracking: ((g.tracking as string) ?? "category") as Goal["tracking"],
          title: g.title as string, categoryId: g.categoryId as string | undefined,
          target: (g.target as number) ?? 1, period: ((g.period as string) ?? "weekly") as Goal["period"],
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

  // Sync notification count to sidebar badge.
  // Recovery is surfaced via the Today tab card, not as a duplicate insight count.
  useEffect(() => {
    if (!pipeline) return;
    const recoveryBonus = pipeline.recoveryIntelligence.recoveryScore < 50 ? 1 : 0;
    const nonRecoveryInsights = pipeline.response.insights.filter(i => i.type !== "recovery").length;
    setAetherisCount(recoveryBonus + nonRecoveryInsights + pipeline.suggestions.length);
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

  // Proactive mode — when pipeline surfaces critical insights, push a nudge to chat
  const proactiveSentIds = useRef(new Set<string>());
  useEffect(() => {
    if (!settings.featureToggles.proactiveMode || !pipeline || !activeSessionId) return;
    const critical = pipeline.response.insights.filter(i => i.severity === "critical");
    if (critical.length === 0) return;
    const unseen = critical.filter(i => !proactiveSentIds.current.has(i.title + i.type));
    if (unseen.length === 0) return;
    for (const ins of unseen) proactiveSentIds.current.add(ins.title + ins.type);
    const lines = unseen.map(i => `• **${i.title}** — ${i.detail}`).join("\n");
    addMessage(activeSessionId, {
      role: "assistant",
      content: `Proactive analysis found ${unseen.length} critical issue${unseen.length > 1 ? "s" : ""} in your schedule:\n\n${lines}\n\nWould you like me to address any of these?`,
    });
  }, [pipeline, settings.featureToggles.proactiveMode, activeSessionId]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading || !activeSessionId) return;

    setInput("");
    setLoading(true);
    setStreamingText("");

    addMessage(activeSessionId, { role: "user", content: text });

    let fullResponse = "";

    try {
      const stream = streamChatMessage(data, activeSession.messages, text, settings.autonomy);
      for await (const chunk of stream) {
        fullResponse += chunk;
        setStreamingText(fullResponse);
      }
    } catch (err) {
      console.error("Chat stream error:", err);
      const msg = err instanceof Error ? err.message : String(err);
      fullResponse = `Sorry, I encountered an error: ${msg}`;
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

  const providerInfo = useMemo(() => {
    const s = loadSettingsSync();
    const reg = getProviderRegistration(s.providerId);
    const name = reg?.name ?? s.providerId;
    const model = s.models[s.providerId] ?? reg?.defaultModel ?? "";
    return `Powered by ${name}${model ? " · " + model : ""} · AI can make mistakes`;
  }, []);

  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();

  const todayAgenda = useMemo(() => {
    return buildAgendaForDate(data, new Date())
      .filter((a) => a.kind !== "sleep" && !(a as { sleepBoundary?: boolean }).sleepBoundary)
      .sort((a, b) => a.start.localeCompare(b.start));
  }, [data.routine, data.commitments]); // eslint-disable-line react-hooks/exhaustive-deps

  const todayTotalMin = todayAgenda.reduce((s, a) => s + durationMin(a.start, a.end), 0);
  const todayFocusMin = todayAgenda
    .filter((a) => (data.meta.focusCategoryIds ?? []).includes(a.kind))
    .reduce((s, a) => s + durationMin(a.start, a.end), 0);

  const todayCount = (recoveryIntel.recoveryScore < 50 ? 1 : 0) + optimization.conflicts.length;
  const tabs: { key: TabView; label: string; icon: typeof Brain; count: number }[] = [
    { key: "today", label: "Today", icon: CalendarDays, count: todayCount },
    { key: "analysis", label: "Analysis", icon: Brain, count: insights.length + suggestions.length },
    { key: "reports", label: "Reports", icon: FileText, count: 0 },
    { key: "learning", label: "Learning", icon: Brain, count: 0 },
    { key: "history", label: "History", icon: History, count: 0 },
    { key: "metrics", label: "Metrics", icon: BarChart3, count: 0 },
  ];

  return (
    <>
      <style dangerouslySetInnerHTML={{__html:`@keyframes alert-blink{0%,100%{opacity:1}50%{opacity:0.3;background-color:rgba(239,68,68,0.08)}}.animate-alert-blink{animation:alert-blink 0.4s ease-in-out 3}html,body{overflow-x:hidden;width:100%}`}} />
      <div className="flex h-full bg-background overflow-hidden">
      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
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

        {/* Messages — scrollable */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
          {activeSession && activeSession.messages.length === 0 && !loading ? (
            <WelcomeScreen onPromptClick={handleExamplePrompt} />
          ) : (
            <ChatThread
              messages={activeSession?.messages ?? []}
              loading={loading}
              streamingText={streamingText}
              onUndo={handleUndo}
              data={data}
            />
          )}
        </div>

        {/* Input — always visible at bottom */}
        <div className="shrink-0 border-t border-border bg-background px-4 pb-3 pt-2">
          <div className="rounded-2xl border border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-sm">
            <div className="flex items-center gap-1.5 px-3 pt-2 pb-1">
              <div className="flex gap-1.5 overflow-x-auto min-w-0">
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

              {/* AI Behavior bubble — top-right of input bubble */}
              <div className="ml-auto shrink-0">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      title="AI Behavior"
                      className={`relative h-6 w-6 rounded-full grid place-items-center transition-colors ${
                        settings.autonomy !== "balanced" || settings.featureToggles.proactiveMode
                          ? "bg-secondary/15 text-secondary hover:bg-secondary/20"
                          : "bg-secondary/5 text-muted-foreground/60 hover:bg-secondary/10 hover:text-muted-foreground"
                      }`}
                    >
                      <SlidersHorizontal className="h-3 w-3" />
                      {settings.featureToggles.proactiveMode && (
                        <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-secondary" />
                      )}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 p-0" onCloseAutoFocus={(e) => e.preventDefault()}>
                    <div className="px-3 pt-3 pb-1">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium mb-2">AI Behavior</p>
                      <div className="space-y-0.5">
                        {(["conservative", "balanced", "aggressive"] as const).map((level, i) => {
                          const labels = ["Mild", "Balanced", "Aggressive"];
                          const descs  = ["Suggests only — always asks", "Acts on low-risk, asks for deletions", "Acts freely — no confirmation"];
                          const active = settings.autonomy === level;
                          return (
                            <button
                              key={level}
                              onClick={() => setAutonomy(level)}
                              className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-left transition-colors ${
                                active ? "bg-secondary/15" : "hover:bg-secondary/5"
                              }`}
                            >
                              <span className={`h-2 w-2 rounded-full shrink-0 border-2 transition-colors ${active ? "border-secondary bg-secondary" : "border-muted-foreground/30"}`} />
                              <div className="min-w-0">
                                <div className={`text-xs font-medium leading-none ${active ? "text-secondary" : "text-primary/80"}`}>{labels[i]}</div>
                                <div className="text-[10px] text-muted-foreground/50 mt-0.5 leading-none">{descs[i]}</div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <DropdownMenuSeparator />
                    <button
                      onClick={() => setFeatureToggle("proactiveMode", !settings.featureToggles.proactiveMode)}
                      className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-secondary/5 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Zap className={`h-3.5 w-3.5 shrink-0 ${settings.featureToggles.proactiveMode ? "text-secondary" : "text-muted-foreground/40"}`} />
                        <div className="text-left">
                          <div className="text-xs font-medium text-primary/80">Proactive Mode</div>
                          <div className="text-[10px] text-muted-foreground/50 leading-none mt-0.5">Push schedule insights automatically</div>
                        </div>
                      </div>
                      <div className={`h-4 w-7 rounded-full relative transition-colors shrink-0 ml-2 ${settings.featureToggles.proactiveMode ? "bg-secondary" : "bg-muted-foreground/20"}`}>
                        <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-background shadow-sm transition-all ${settings.featureToggles.proactiveMode ? "left-3.5" : "left-0.5"}`} />
                      </div>
                    </button>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
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
      <div className={`overflow-hidden transition-all duration-300 ease-in-out hidden lg:block ${
        showSidebar ? "w-80 opacity-100 border-l border-border" : "w-0 opacity-0"
      }`}>
          <div className="w-80 shrink-0 bg-background min-w-0 overflow-y-auto max-h-full">
          <div className="p-4">
            {/* Tab bar */}
            <div className="flex flex-wrap gap-1 mb-4">
              {tabs.map((tabDef) => (
                <button
                  key={tabDef.key}
                  onClick={() => setTab(tabDef.key)}
                  className={`flex items-center gap-1 px-2 py-1 text-[9px] font-medium uppercase tracking-wider rounded-full border transition-colors ${
                    tab === tabDef.key
                      ? "bg-secondary/15 border-secondary/40 text-secondary"
                      : "border-transparent text-muted-foreground hover:text-primary hover:border-secondary/20 hover:bg-secondary/5"
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

            {/* Today: day agenda + structural issues only */}
            {tab === "today" && (
              <div className="space-y-3">
                {pipelineLoading ? (
                  <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-secondary" /></div>
                ) : (
                  <>
                    {/* Today's agenda — the actual day schedule */}
                    <div className="border border-border rounded-lg overflow-hidden">
                      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/60">
                        <CalendarDays className="h-3.5 w-3.5 text-secondary/70" />
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Today</span>
                        <span className="ml-auto text-[9px] text-muted-foreground/40 num">
                          {todayAgenda.length} blocks · {fmtDur(todayTotalMin)}
                        </span>
                      </div>
                      {todayAgenda.length === 0 ? (
                        <p className="text-[11px] text-muted-foreground/50 text-center py-4 px-3">No blocks scheduled today</p>
                      ) : (
                        <div>
                          {todayAgenda.map((block, i) => {
                            const bStart = timeToMinutes(block.start);
                            const bEnd = timeToMinutes(block.end === "24:00" ? "23:59" : block.end);
                            const isActive = bStart <= nowMin && nowMin < bEnd;
                            const isPast = bEnd <= nowMin;
                            const style = safeKindStyle(block.kind, data.categories);
                            return (
                              <div
                                key={`${String(block.id ?? block.start)}-${i}`}
                                className={`flex items-center gap-2.5 px-3 py-2 border-b border-border/20 last:border-0 transition-colors ${
                                  isActive ? "bg-secondary/5" : ""
                                } ${isPast ? "opacity-35" : ""}`}
                              >
                                <span
                                  className={`h-1.5 w-1.5 rounded-full shrink-0 ${style.dot}`}
                                  style={style.dotStyle}
                                />
                                <span className="text-[10px] text-muted-foreground/50 num shrink-0 tabular-nums">
                                  {block.start}
                                </span>
                                <span className={`text-[11px] flex-1 min-w-0 truncate ${isActive ? "text-secondary font-medium" : "text-primary/80"}`}>
                                  {block.titleCustom ?? block.title}
                                </span>
                                {isActive && (
                                  <span className="text-[8px] bg-secondary/15 text-secondary px-1.5 py-0.5 rounded-full shrink-0 font-semibold uppercase tracking-wider">
                                    Now
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {todayFocusMin > 0 && (
                        <div className="flex items-center justify-between px-3 py-1.5 border-t border-border/60 bg-muted/10">
                          <span className="text-[9px] text-muted-foreground/50 uppercase tracking-wider">Focus today</span>
                          <span className="text-[10px] text-secondary/80 num font-medium">{fmtDur(todayFocusMin)}</span>
                        </div>
                      )}
                    </div>

                    {/* Recovery warning */}
                    {recoveryIntel.recoveryScore < 50 && (
                      <AlertCard
                        severity="critical"
                        collapsible
                        title={locale === "pt" ? "Pontuação de recuperação criticamente baixa" : "Recovery score critically low"}
                        detail={recoveryIntel.recommendations[0] ?? (locale === "pt" ? "Considere adicionar blocos de descanso ou reduzir a intensidade." : "Consider adding rest blocks or reducing intensity.")}
                      />
                    )}

                    {/* Structural conflicts only — no AI insights here */}
                    {optimization.conflicts.slice(0, 3).map((c, i) => (
                      <AlertCard key={i} severity="warning" title="Scheduling conflict" detail={c.detail} />
                    ))}

                    {optimization.conflicts.length === 0 && recoveryIntel.recoveryScore >= 50 && (
                      <p className="text-[11px] text-muted-foreground/40 text-center py-1">No structural issues</p>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Analysis: score + AI insights + suggestions + structural issues */}
            {tab === "analysis" && (
              <div className="space-y-3 overflow-x-hidden">
                {pipelineLoading ? (
                  <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-secondary" /></div>
                ) : (
                  <>
                    {/* Composition score + key structural metrics */}
                    <div className="border border-border rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Composition score</span>
                        <span className="font-display text-xl text-secondary num leading-none">
                          {data.ledger.compositionScore}
                          <span className="text-xs text-muted-foreground/40 font-sans">/100</span>
                        </span>
                      </div>
                      <div className="mt-2 h-1 rounded-full bg-border overflow-hidden">
                        <div className="h-full bg-secondary transition-all" style={{ width: `${data.ledger.compositionScore}%` }} />
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-3">
                        {[
                          ["Conflicts", optimization.conflicts.length],
                          ["Gaps", optimization.idleGaps.length],
                          ["Consist.", `${Math.round(optimization.routineConsistency * 100)}%`],
                        ].map(([l, v]) => (
                          <div key={String(l)} className="text-center">
                            <div className="text-[9px] uppercase tracking-wider text-muted-foreground/40">{l}</div>
                            <div className="text-sm font-medium text-primary num mt-0.5">{v}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* AI insights (non-critical, non-recovery) */}
                    {insights.filter(i => i.severity !== "critical" && i.type !== "recovery").length > 0 && (
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground/50 mb-2 px-0.5 flex items-center gap-1.5">
                          <Sparkles className="h-3 w-3" />
                          AI insights
                        </div>
                        {insights
                          .filter(i => i.severity !== "critical" && i.type !== "recovery")
                          .slice(0, 4)
                          .map((ins) => (
                            <InsightCard key={ins.title + ins.detail} insight={ins} blinking={false} />
                          ))
                        }
                      </div>
                    )}

                    {suggestions.length > 0 && (
                      <div className="pt-2 border-t border-border/40">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-2 px-0.5">Suggestions</div>
                        {suggestions.slice(0, 5).map((s) => {
                          const vote = getSuggestionFeedback(s.id);
                          return (
                            <div key={s.id} className="border border-border rounded-lg p-3 mb-2 last:mb-0">
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-xs font-medium text-primary truncate">{s.title}</div>
                                {s.priority && (
                                  <span className={`shrink-0 text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                                    s.priority === "high"
                                      ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                                      : s.priority === "medium"
                                      ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                                      : "bg-muted text-muted-foreground border border-border/50"
                                  }`}>
                                    {s.priority === "high" ? "Sure" : s.priority === "medium" ? "Fair" : "Unsure"}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-muted-foreground mt-1">{s.detail}</p>
                              <div className="flex items-center gap-2 mt-2 pt-1.5 border-t border-border/40">
                                <button
                                  onClick={() => {
                                    setInput(`Please apply this suggestion: "${s.title}" — ${s.detail}`);
                                    // Scroll focus back to chat input area
                                    const inputEl = document.querySelector<HTMLInputElement>('input[placeholder*="Aetheris"]');
                                    inputEl?.focus();
                                  }}
                                  className="flex items-center gap-1 text-[10px] text-secondary/70 hover:text-secondary transition-colors mr-auto"
                                  title="Ask Aetheris to apply this"
                                >
                                  <Send className="h-3 w-3" />
                                  Apply
                                </button>
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
                    {optimization.conflicts.length > 0 && (
                      <div className="pt-2 border-t border-border/40">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-2 px-0.5">Structural conflicts</div>
                        <div className="space-y-2">
                          {optimization.conflicts.map((c, i) => (
                            <div key={i} className="border border-border rounded-lg p-2.5">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
                                  <span className="text-[11px] font-medium text-primary truncate">
                                    {c.type === "sleep_overlap" ? "Sleep overlap" : "Overlap"}
                                  </span>
                                </div>
                                <button
                                  onClick={() => navigate("/dashboard")}
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
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-2 px-0.5">Open gaps</div>
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
                    {insights.filter(i => i.severity !== "critical" && i.type !== "recovery").length === 0 && suggestions.length === 0 && optimization.conflicts.length === 0 && (
                      <p className="text-[11px] text-muted-foreground/40 text-center py-4">No issues detected</p>
                    )}
                  </>
                )}
              </div>
            )}

            {tab === "reports" && (
              <ReportsPanel
                data={data}
                onSendToChat={(prompt) => {
                  setInput(prompt);
                  const inputEl = document.querySelector<HTMLInputElement>('input[placeholder*="Aetheris"]');
                  inputEl?.focus();
                }}
              />
            )}

            {tab === "learning" && (
              <div className="space-y-3">
                <LearningInsights profile={profile} />
              </div>
            )}

            {tab === "history" && (
              <div className="overflow-x-hidden">
                <AuditHistory compact />
              </div>
            )}

            {tab === "metrics" && (
              <div className="overflow-x-hidden">
                <AetherisMetrics compact />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  </>
    )
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

// One alert card for both recovery and conflict warnings. Severity drives the
// color; `collapsible` toggles the detail behind a chevron (recovery) vs. always
// showing it (structural conflicts). Replaces two near-identical hand-rolled cards.
const ALERT_TONE = {
  critical: { border: "border-destructive/40", icon: "text-destructive", divider: "border-destructive/20" },
  warning: { border: "border-amber-500/30", icon: "text-amber-600 dark:text-amber-400", divider: "border-amber-500/20" },
} as const;

function AlertCard({
  severity,
  title,
  detail,
  collapsible,
}: {
  severity: keyof typeof ALERT_TONE;
  title: string;
  detail?: string;
  collapsible?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const tone = ALERT_TONE[severity];
  const showDetail = !!detail && (!collapsible || open);
  return (
    <div className={`rounded-lg border p-3 ${tone.border}`}>
      <button
        type="button"
        onClick={collapsible ? () => setOpen(!open) : undefined}
        className={`w-full flex items-center justify-between text-left ${collapsible ? "" : "cursor-default"}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <AlertTriangle className={`h-3.5 w-3.5 shrink-0 ${tone.icon}`} />
          <span className="text-[11px] font-medium text-primary">{title}</span>
        </div>
        {collapsible && (
          <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform shrink-0 ${open ? "rotate-180" : ""}`} />
        )}
      </button>
      {showDetail && (
        <p className={`text-[11px] text-muted-foreground leading-relaxed mt-1.5 ${collapsible ? `pt-1.5 border-t ${tone.divider}` : ""}`}>
          {detail}
        </p>
      )}
    </div>
  );
}


