import { Sparkles, Brain, Target, Coffee, MessageSquare, Wand2 } from "lucide-react";

const EXAMPLE_PROMPTS = [
  { icon: Brain, label: "Optimize Thursday", prompt: "What does my ideal Thursday look like?" },
  { icon: Coffee, label: "Recover from Monday", prompt: "Help me recover from a heavy Monday" },
  { icon: Target, label: "Study schedule", prompt: "Create a study schedule for exams" },
  { icon: Sparkles, label: "Lighten my load", prompt: "I have a heavy day tomorrow. Help me lighten the load." },
  { icon: Wand2, label: "Add deep work", prompt: "When are my best times for deep work this week?" },
  { icon: MessageSquare, label: "Week analysis", prompt: "Analyze my schedule for this week. What's working and what needs adjustment?" },
];

export default function WelcomeScreen({ onPromptClick }: { onPromptClick: (prompt: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-secondary/30 to-secondary/10 grid place-items-center mb-5">
        <Sparkles className="h-7 w-7 text-secondary" />
      </div>
      <h2 className="font-display text-2xl text-primary text-center">Welcome to Aetheris</h2>
      <p className="text-sm text-muted-foreground text-center mt-2 max-w-md">
        Your AI schedule assistant. Ask questions, get insights, and make changes to your routine.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-8 w-full max-w-lg">
        {EXAMPLE_PROMPTS.map((item) => (
          <button
            key={item.label}
            onClick={() => onPromptClick(item.prompt)}
            className="flex items-center gap-2.5 px-3.5 py-3 rounded-lg border border-border/60 hover:border-secondary/40 hover:bg-secondary/5 transition-all text-left group"
          >
            <item.icon className="h-4 w-4 text-secondary shrink-0 group-hover:scale-110 transition-transform" />
            <span className="text-sm text-primary group-hover:text-secondary transition-colors">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
