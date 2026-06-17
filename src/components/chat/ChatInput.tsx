import { useState, useRef, useEffect } from "react";
import { Send, Sparkles, Brain, Coffee, Target } from "lucide-react";

const QUICK_CHIPS = [
  { icon: Brain, label: "Analyze week", prompt: "Analyze my schedule for this week." },
  { icon: Coffee, label: "Recovery score", prompt: "What's my recovery score?" },
  { icon: Target, label: "Optimize today", prompt: "Help me optimize my day." },
  { icon: Sparkles, label: "Suggest blocks", prompt: "Suggest blocks I should add to my schedule." },
];

export default function ChatInput({
  value,
  onChange,
  onSubmit,
  loading,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  loading: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [loading]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex gap-1.5 px-3 pt-2 pb-1 overflow-x-auto">
        {QUICK_CHIPS.map((chip) => (
          <button
            key={chip.label}
            onClick={() => onChange(chip.prompt)}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary px-2 py-1 rounded-full border border-border/50 hover:border-secondary/30 transition-colors shrink-0"
          >
            <chip.icon className="h-3 w-3" />
            {chip.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 px-3 py-3">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Aetheris about your schedule..."
          disabled={loading}
          className="flex-1 bg-transparent text-sm text-primary placeholder:text-muted-foreground/50 focus:outline-none disabled:opacity-50"
        />
        <button
          onClick={onSubmit}
          disabled={!value.trim() || loading}
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
  );
}
