import { useState } from "react";

const REASONS = [
  { value: "irrelevant" as const, label: "Not relevant" },
  { value: "incorrect" as const, label: "Incorrect info" },
  { value: "too-vague" as const, label: "Too vague" },
  { value: "already-known" as const, label: "Already known" },
  { value: "other" as const, label: "Other" },
];

interface SuggestionFeedbackDialogProps {
  onSubmit: (reason: string, notes: string) => void;
  onCancel: () => void;
}

export default function SuggestionFeedbackDialog({ onSubmit, onCancel }: SuggestionFeedbackDialogProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  const handleSubmit = () => {
    if (!selected) return;
    onSubmit(selected, notes);
  };

  return (
    <>
      {/* backdrop */}
      <div className="fixed inset-0 z-40" onClick={onCancel} />
      {/* popover */}
      <div className="absolute right-0 top-full mt-1 z-50 w-56 border border-border rounded-lg bg-popover shadow-lg p-3">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">What's wrong?</div>
        <div className="space-y-1">
          {REASONS.map((r) => (
            <button
              key={r.value}
              onClick={() => setSelected(r.value)}
              className={`w-full text-left text-xs px-2 py-1.5 rounded-md transition-colors ${
                selected === r.value
                  ? "bg-secondary/20 text-secondary font-medium"
                  : "text-muted-foreground hover:bg-secondary/5 hover:text-primary"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        {selected === "other" && (
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Tell us more..."
            className="mt-2 w-full text-xs bg-transparent border border-border rounded-md p-1.5 resize-none h-16 placeholder:text-muted-foreground/40 focus:outline-none focus:border-secondary/50"
          />
        )}
        <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-border/40">
          <button onClick={onCancel} className="text-[10px] text-muted-foreground hover:text-primary px-2 py-1">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selected}
            className="text-[10px] bg-secondary text-secondary-foreground px-2.5 py-1 rounded-md font-medium disabled:opacity-40"
          >
            Submit
          </button>
        </div>
      </div>
    </>
  );
}
