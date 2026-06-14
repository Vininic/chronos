import { useCallback, useEffect, useState } from "react";
import { useSchedule } from "@/lib/schedule/store";
import { createEmptySchedule, SCHEDULE_TEMPLATES } from "@/lib/schedule/templates";
import type { ScheduleTemplate } from "@/lib/schedule/templates";

const ONBOARDING_KEY = "chronos.onboarding.v1";

interface OnboardingState {
  seen: boolean;
  dismissedAt?: string;
  choice?: string;
}

function loadState(): OnboardingState {
  try {
    const raw = localStorage.getItem(ONBOARDING_KEY);
    if (raw) return JSON.parse(raw) as OnboardingState;
  } catch { /* ignore */ }
  return { seen: false };
}

function saveState(state: OnboardingState) {
  try {
    localStorage.setItem(ONBOARDING_KEY, JSON.stringify(state));
  } catch { /* ignore */ }
}

export function useOnboarding() {
  const [state, setState] = useState<OnboardingState>(loadState);
  const { replace } = useSchedule();

  useEffect(() => {
    saveState(state);
  }, [state]);

  const complete = useCallback((choice: string) => {
    if (choice === "scratch") {
      replace(createEmptySchedule());
    } else if (choice.startsWith("template:")) {
      const templateId = choice.slice("template:".length);
      const template = SCHEDULE_TEMPLATES.find((t) => t.id === templateId);
      if (template) {
        replace(template.generate());
      }
    }
    setState({ seen: true, dismissedAt: new Date().toISOString(), choice });
  }, [replace]);

  const applyTemplate = useCallback((templateId: string) => {
    const template = SCHEDULE_TEMPLATES.find((t) => t.id === templateId);
    if (template) {
      replace(template.generate());
      setState({ seen: true, dismissedAt: new Date().toISOString(), choice: `template:${templateId}` });
    }
  }, [replace]);

  const dismiss = useCallback(() => {
    setState({ seen: true, dismissedAt: new Date().toISOString() });
  }, []);

  return {
    isFirstRun: !state.seen,
    state,
    templates: SCHEDULE_TEMPLATES,
    complete,
    applyTemplate,
    dismiss,
  };
}
