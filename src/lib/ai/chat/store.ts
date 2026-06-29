import { useState, useEffect, useCallback } from "react";

export const CHAT_STORAGE_KEY = "chronos.chat.v1";

export type MessageRole = "user" | "assistant" | "system" | "tool";

export interface FileAttachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  data: string;
  kind: "image" | "spreadsheet" | "json" | "calendar" | "text" | "other";
}

export interface ToolCallAction {
  tool: string;
  params: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: string;
  timestamp: string;
  undone?: boolean;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
  toolCalls?: ToolCallAction[];
  attachments?: FileAttachment[];
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
  providerId?: string;
}

interface ChatStore {
  sessions: ChatSession[];
  activeSessionId: string | null;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadStore(): ChatStore {
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ChatStore;
      if (parsed.sessions && Array.isArray(parsed.sessions)) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return { sessions: [], activeSessionId: null };
}

function saveStore(store: ChatStore): void {
  try {
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // ignore quota
  }
}

export function createNewSession(title?: string): ChatSession {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    title: title ?? "New conversation",
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function useChatStore() {
  const [store, setStore] = useState<ChatStore>(loadStore);

  useEffect(() => {
    saveStore(store);
  }, [store]);

  const activeSession = store.sessions.find((s) => s.id === store.activeSessionId) ?? null;

  const createSession = useCallback((title?: string) => {
    const session = createNewSession(title);
    setStore((prev) => ({
      sessions: [...prev.sessions, session],
      activeSessionId: session.id,
    }));
    return session;
  }, []);

  const setActiveSession = useCallback((id: string | null) => {
    setStore((prev) => ({ ...prev, activeSessionId: id }));
  }, []);

  const deleteSession = useCallback((id: string) => {
    setStore((prev) => {
      const sessions = prev.sessions.filter((s) => s.id !== id);
      return {
        sessions,
        activeSessionId: prev.activeSessionId === id
          ? (sessions[sessions.length - 1]?.id ?? null)
          : prev.activeSessionId,
      };
    });
  }, []);

  const renameSession = useCallback((id: string, title: string) => {
    setStore((prev) => ({
      ...prev,
      sessions: prev.sessions.map((s) =>
        s.id === id ? { ...s, title, updatedAt: new Date().toISOString() } : s
      ),
    }));
  }, []);

  const addMessage = useCallback((sessionId: string, message: Omit<ChatMessage, "id" | "timestamp">) => {
    const msg: ChatMessage = {
      ...message,
      id: generateId(),
      timestamp: new Date().toISOString(),
    };
    setStore((prev) => ({
      ...prev,
      sessions: prev.sessions.map((s) =>
        s.id === sessionId
          ? {
              ...s,
              messages: [...s.messages, msg],
              updatedAt: new Date().toISOString(),
              title: s.messages.length === 0 && message.role === "user"
                ? message.content.slice(0, 60)
                : s.title,
            }
          : s
      ),
    }));
    return msg;
  }, []);

  const updateMessage = useCallback((sessionId: string, messageId: string, patch: Partial<ChatMessage>) => {
    setStore((prev) => ({
      ...prev,
      sessions: prev.sessions.map((s) =>
        s.id === sessionId
          ? {
              ...s,
              messages: s.messages.map((m) =>
                m.id === messageId ? { ...m, ...patch } : m
              ),
              updatedAt: new Date().toISOString(),
            }
          : s
      ),
    }));
  }, []);

  const addToolCall = useCallback((
    sessionId: string,
    messageId: string,
    toolCall: ToolCallAction,
  ) => {
    setStore((prev) => ({
      ...prev,
      sessions: prev.sessions.map((s) =>
        s.id === sessionId
          ? {
              ...s,
              messages: s.messages.map((m) =>
                m.id === messageId
                  ? { ...m, toolCalls: [...(m.toolCalls ?? []), toolCall] }
                  : m
              ),
              updatedAt: new Date().toISOString(),
            }
          : s
      ),
    }));
  }, []);

  const undoLastToolCall = useCallback((sessionId: string) => {
    setStore((prev) => {
      const session = prev.sessions.find((s) => s.id === sessionId);
      if (!session) return prev;

      const messages = [...session.messages];
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (msg.toolCalls?.length) {
          const lastCall = msg.toolCalls[msg.toolCalls.length - 1];
          if (!lastCall.undone) {
            messages[i] = {
              ...msg,
              toolCalls: msg.toolCalls.map((tc, idx) =>
                idx === msg.toolCalls!.length - 1 ? { ...tc, undone: true } : tc
              ),
            };
            return {
              ...prev,
              sessions: prev.sessions.map((s) =>
                s.id === sessionId ? { ...s, messages, updatedAt: new Date().toISOString() } : s
              ),
            };
          }
        }
      }
      return prev;
    });
  }, []);

  const clearAllSessions = useCallback(() => {
    setStore({ sessions: [], activeSessionId: null });
  }, []);

  const hasToolCalls = useCallback((sessionId: string, messageId: string): boolean => {
    const session = store.sessions.find((s) => s.id === sessionId);
    if (!session) return false;
    const msg = session.messages.find((m) => m.id === messageId);
    return (msg?.toolCalls?.length ?? 0) > 0;
  }, [store.sessions]);

  return {
    sessions: store.sessions,
    activeSessionId: store.activeSessionId,
    activeSession,
    createSession,
    setActiveSession,
    deleteSession,
    renameSession,
    addMessage,
    updateMessage,
    addToolCall,
    undoLastToolCall,
    clearAllSessions,
    hasToolCalls,
  };
}
