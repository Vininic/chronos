import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { getSupabaseClient } from "./supabase/client";

const KEY = "chronos.session.v1";

interface Session { name: string; signedInAt: string; email?: string; }
interface Ctx {
  session: Session | null;
  signIn: (name: string, email?: string, password?: string) => Promise<string | null> | void;
  signOut: () => Promise<void> | void;
  updateName: (name: string) => Promise<void> | void;
  isCloud: boolean;
}
const AuthCtx = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const name = (parsed.name as string) || (parsed.email as string | undefined)?.split("@")[0] || "Composer";
      return { name, signedInAt: (parsed.signedInAt as string) || new Date().toISOString(), email: parsed.email as string | undefined };
    } catch { return null; }
  });

  const supabase = getSupabaseClient();

  useEffect(() => {
    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, supabaseSession) => {
      if (supabaseSession?.user) {
        const user = supabaseSession.user;
        setSession({
          name: user.user_metadata?.name ?? user.email?.split("@")[0] ?? "User",
          signedInAt: user.created_at ?? new Date().toISOString(),
          email: user.email,
        });
      } else {
        // No Supabase session. Preserve a local "guest" session (name only, no email) —
        // it must survive even when a Supabase project is configured. Only clear a
        // previously signed-in cloud session (the INITIAL_SESSION/SIGNED_OUT case).
        setSession((prev) => (prev?.email ? null : prev));
      }
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (session) localStorage.setItem(KEY, JSON.stringify(session));
    else localStorage.removeItem(KEY);
  }, [session]);

  const signIn = useCallback(async (name?: string, email?: string, password?: string) => {
    if (supabase && email && password) {
      let result;
      const existing = await supabase.auth.signInWithPassword({ email, password });
      if (existing.error?.message?.includes("Invalid login credentials")) {
        result = await supabase.auth.signUp({ email, password, options: { data: { name } } });
      } else {
        result = existing;
      }
      if (result.error) return result.error.message;
      if (!result.data?.user) return "No user returned";
      setSession({
        name: result.data.user.user_metadata?.name ?? name ?? email.split("@")[0],
        signedInAt: result.data.user.created_at ?? new Date().toISOString(),
        email: result.data.user.email,
      });
      return null;
    }

    // Local fallback
    const trimmed = (name || "").trim() || "Composer";
    setSession({ name: trimmed, signedInAt: new Date().toISOString() });
    return null;
  }, [supabase]);

  const signOut = useCallback(async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    setSession(null);
  }, [supabase]);

  const updateName = useCallback(async (name: string) => {
    if (supabase) {
      await supabase.auth.updateUser({ data: { name } });
    }
    setSession((prev) => (prev ? { ...prev, name } : null));
  }, [supabase]);

  return (
    <AuthCtx.Provider value={{ session, signIn, signOut, updateName, isCloud: !!supabase }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
