import { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from "react";
import { toast } from "@/hooks/use-toast";
import { useT } from "@/lib/i18n/I18nProvider";

export interface ActiveBlock {
  title: string;
  start: string;
  end: string;
  kind: string;
}

interface TimerCtx {
  running: boolean;
  seconds: number;
  target: number;
  activeBlock: ActiveBlock | null;
  start: (min: number) => void;
  startScheduled: (mins: number, block: ActiveBlock) => void;
  togglePause: () => void;
  reset: () => void;
  dismiss: () => void;
  mm: string;
  ss: string;
}

const TimerCtxImpl = createContext<TimerCtx | null>(null);

export function TimerProvider({ children }: { children: React.ReactNode }) {
  const [running, setRunning] = useState(false);
  const [seconds, setSeconds] = useState(25 * 60);
  const [target, setTarget] = useState(25 * 60);
  const [activeBlock, setActiveBlock] = useState<ActiveBlock | null>(null);
  const ref = useRef<number | null>(null);
  const t = useT();

  useEffect(() => {
    if (!running) return;
    ref.current = window.setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          window.clearInterval(ref.current!);
          setRunning(false);
          toast({ title: t.chronos.focus.sealed_done });
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => { if (ref.current) window.clearInterval(ref.current); };
  }, [running, t]);

  const start = useCallback((min: number) => {
    setTarget(min * 60);
    setSeconds(min * 60);
    setRunning(true);
    setActiveBlock(null);
  }, []);

  const startScheduled = useCallback((mins: number, block: ActiveBlock) => {
    setTarget(mins * 60);
    setSeconds(mins * 60);
    setRunning(true);
    setActiveBlock(block);
  }, []);

  const togglePause = useCallback(() => { setRunning((r) => !r); }, []);
  const reset = useCallback(() => { setRunning(false); setSeconds(target); setActiveBlock(null); }, [target]);
  const dismiss = useCallback(() => { setRunning(false); setSeconds(target); setActiveBlock(null); }, [target]);

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  const value = useMemo(() => ({
    running, seconds, target, activeBlock,
    start, startScheduled, togglePause, reset, dismiss,
    mm, ss,
  }), [running, seconds, target, activeBlock, start, startScheduled, togglePause, reset, dismiss, mm, ss]);

  return (
    <TimerCtxImpl.Provider value={value}>
      {children}
    </TimerCtxImpl.Provider>
  );
}

export function useTimer() {
  const ctx = useContext(TimerCtxImpl);
  if (!ctx) throw new Error("useTimer must be used within TimerProvider");
  return ctx;
}
