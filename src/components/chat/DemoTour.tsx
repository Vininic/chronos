import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { isDemoMode, setDemoMode } from "@/lib/demo/generator";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sparkles, Brain, Wand2, ChevronRight, X } from "lucide-react";

const TOUR_KEY = "chronos.demo.tour-completed";

interface TourStep {
  icon: typeof Sparkles;
  title: string;
  description: string;
  action?: { label: string; to: string };
}

const STEPS: TourStep[] = [
  {
    icon: Sparkles,
    title: "Here's your schedule",
    description: "A full weekly schedule with 10 categories, 3 goals, and realistic blocks has been loaded. Explore it in Today, Week, and Focus views.",
  },
  {
    icon: Brain,
    title: "Chat with Aetheris",
    description: "Type any question about your schedule in the chat below. Try 'Analyze my week' or 'What's my recovery score?'",
  },
  {
    icon: Wand2,
    title: "Optimize with AI",
    description: "Ask Aetheris to make changes: 'Optimize my Thursday', 'Add a study block on Tuesday', or 'Make tomorrow lighter'.",
  },
];

export default function DemoTour() {
  const [step, setStep] = useState(() => {
    const completed = localStorage.getItem(TOUR_KEY) === "true";
    return !isDemoMode() || completed ? -1 : 0;
  });
  const navigate = useNavigate();

  useEffect(() => {
    const completed = localStorage.getItem(TOUR_KEY) === "true";
    if (!isDemoMode() || completed) {
      setStep(-1);
    }
  }, []);

  if (step < 0 || step >= STEPS.length) return null;

  const current = STEPS[step];

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      localStorage.setItem(TOUR_KEY, "true");
      setStep(-1);
    }
  };

  const handleSkip = () => {
    localStorage.setItem(TOUR_KEY, "true");
    setStep(-1);
  };

  return (
    <div className="fixed bottom-24 right-6 z-50 w-80 shadow-xl">
      <Card className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-full bg-secondary/20 grid place-items-center">
              <current.icon className="h-4 w-4 text-secondary" />
            </div>
            <div>
              <p className="text-xs font-medium text-primary">{current.title}</p>
              <p className="text-[10px] text-muted-foreground">Step {step + 1} of {STEPS.length}</p>
            </div>
          </div>
          <button onClick={handleSkip} className="text-muted-foreground hover:text-primary transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">{current.description}</p>
        <div className="flex items-center justify-between pt-1">
          <div className="flex gap-1">
            {STEPS.map((_, i) => (
              <span key={i} className={`h-1.5 w-1.5 rounded-full transition-colors ${
                i === step ? "bg-secondary" : "bg-muted"
              }`} />
            ))}
          </div>
          <Button size="sm" className="h-7 text-xs" onClick={handleNext}>
            {step < STEPS.length - 1 ? (
              <>Next <ChevronRight className="h-3 w-3 ml-1" /></>
            ) : (
              "Got it!"
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
}
