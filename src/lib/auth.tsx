import { createContext, ReactNode, useContext, useEffect, useState } from "react";

const KEY = "chronos.session.v1";

interface Session { email: string; name: string; signedInAt: string; }
interface Ctx {
  session: Session | null;
  signIn: (email: string) => void;
  signOut: () => void;
}
const AuthCtx = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => {
    try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
  });
  useEffect(() => {
    if (session) localStorage.setItem(KEY, JSON.stringify(session));
    else localStorage.removeItem(KEY);
  }, [session]);

  function signIn(email: string) {
    const name = email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "Composer";
    setSession({ email, name, signedInAt: new Date().toISOString() });
  }
  function signOut() { setSession(null); }

  return <AuthCtx.Provider value={{ session, signIn, signOut }}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}