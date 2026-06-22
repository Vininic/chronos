import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { TimerCard } from "@/components/dashboard/TimerCard";
import { TimerProvider, useTimer } from "@/lib/timer/TimerContext";
import { I18nProvider } from "@/lib/i18n/I18nProvider";
import { ScheduleProvider } from "@/lib/schedule/store";

function withProviders(node: ReactNode) {
  return (
    <MemoryRouter>
      <I18nProvider>
        <ScheduleProvider>
          <TimerProvider>{node}</TimerProvider>
        </ScheduleProvider>
      </I18nProvider>
    </MemoryRouter>
  );
}

// Lets a test drive the timer the same way the Focus page does.
function StartButton() {
  const timer = useTimer();
  return <button onClick={() => timer.start(25)}>start-25</button>;
}

describe("TimerCard", () => {
  it("shows the idle state with no transport controls before a timer runs", () => {
    const { container } = render(withProviders(<TimerCard />));
    // The card itself renders.
    expect(container.firstChild).not.toBeNull();
    // Idle = no pause/reset controls (those only appear once there is activity).
    expect(screen.queryByLabelText("Pause timer")).toBeNull();
    expect(screen.queryByLabelText("Reset timer")).toBeNull();
    expect(screen.queryByLabelText("Resume timer")).toBeNull();
  });

  it("shows the running readout and transport controls once a timer starts", () => {
    render(withProviders(<><StartButton /><TimerCard /></>));

    fireEvent.click(screen.getByText("start-25"));

    // 25-minute countdown readout (mm:ss).
    expect(screen.getByText("25:00")).toBeDefined();
    expect(screen.getByText("running")).toBeDefined();
    // Active state surfaces the pause + reset transport.
    expect(screen.getByLabelText("Pause timer")).toBeDefined();
    expect(screen.getByLabelText("Reset timer")).toBeDefined();
  });
});
