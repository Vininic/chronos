import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSchedule } from "@/lib/schedule/store";
import { shouldShowDemoPrompt, generateDemoData, setDemoMode, clearDemoData, isDemoMode } from "@/lib/demo/generator";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sparkles, X, RotateCcw } from "lucide-react";

export default function DemoPrompt() {
  const { replace } = useSchedule();
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (shouldShowDemoPrompt()) {
      setVisible(true);
    }
  }, []);

  if (!visible || dismissed) return null;

  const handleLoadDemo = () => {
    const { schedule } = generateDemoData();
    replace(schedule);
    setDemoMode(true);
    setVisible(false);
    navigate("/dashboard/aetheris");
  };

  const handleDismiss = () => {
    setDismissed(true);
    setVisible(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-6 space-y-4 shadow-xl">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-secondary/20 grid place-items-center">
              <Sparkles className="h-5 w-5 text-secondary" />
            </div>
            <div>
              <h2 className="font-display text-lg text-primary">Welcome to Chronos</h2>
              <p className="text-sm text-muted-foreground">Explore the AI-powered schedule planner</p>
            </div>
          </div>
          <button onClick={handleDismiss} className="text-muted-foreground hover:text-primary transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground">
          No schedule found. Load demo data to explore all features — including the AI assistant, weekly planner, learning system, and goal tracking — without creating a schedule from scratch.
        </p>

        <div className="flex gap-2">
          <Button onClick={handleLoadDemo} className="flex-1">
            <Sparkles className="h-4 w-4 mr-2" />
            Load Demo Data
          </Button>
          <Button variant="outline" onClick={handleDismiss}>
            Start Fresh
          </Button>
        </div>
      </Card>
    </div>
  );
}
