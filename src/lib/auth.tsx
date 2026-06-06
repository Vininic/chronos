import { createContext, ReactNode, useContext, useEffect, useState } from "react";

const KEY = "chronos.session.v1";

interface Session { name: string; signedInAt: string; }
interface Ctx {
  session: Session | null;
  signIn: (name: string) => void;
  signOut: () => void;
  updateName: (name: string) => void;
}
const AuthCtx = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      // Migrate old sessions that stored email instead of name
      const name = (parsed.name as string) || (parsed.email as string | undefined)?.split("@")[0] || "Composer";
      return { name, signedInAt: (parsed.signedInAt as string) || new Date().toISOString() };
    } catch { return null; }
  });
  useEffect(() => {
    if (session) localStorage.setItem(KEY, JSON.stringify(session));
    else localStorage.removeItem(KEY);
  }, [session]);

  function signIn(name: string) {
    const trimmed = name.trim() || "Composer";
    setSession({ name: trimmed, signedInAt: new Date().toISOString() });
  }
  function signOut() { setSession(null); }
  function updateName(name: string) {
    setSession((prev) => (prev ? { ...prev, name } : null));
  }

  return <AuthCtx.Provider value={{ session, signIn, signOut, updateName }}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}