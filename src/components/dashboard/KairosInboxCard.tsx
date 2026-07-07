import { useEffect, useState } from "react";
import { CalendarClock, Check, ExternalLink, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useSchedule } from "@/lib/schedule/store";
import { fetchPendingRequests, markScheduled, dismissRequest, type BridgeRequest } from "@/lib/bridge/kairosBridge";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { timeToMinutes } from "@/lib/schedule/types";
import { minutesToTime } from "@/lib/schedule/helpers";

const KAIROS_URL = "https://kairos-suite.vercel.app";

function nowSnap(offsetMin = 0): string {
  const d = new Date(Date.now() + offsetMin * 60000);
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
  return d.toTimeString().slice(0, 5);
}

/** One pending request, with an inline start-time picker before it becomes a
 *  real commitment — Kairos proposes, Chronos still owns the calendar. */
function InboxRow({ request, onResolved }: { request: BridgeRequest; onResolved: (id: string) => void }) {
  const { data, addCommitment } = useSchedule();
  const [start, setStart] = useState(nowSnap(15));
  const [busy, setBusy] = useState(false);
  const end = minutesToTime(timeToMinutes(start) + request.durationMin);

  async function schedule() {
    setBusy(true);
    try {
      const kind = data.categories[0]?.id ?? "shallow";
      const result = addCommitment({
        title: request.title,
        notes: request.notes ? `${request.notes}\n\nFrom Kairos · ${request.projectName}` : `From Kairos · ${request.projectName}`,
        start,
        end,
        kind,
        date: request.dueDate ?? new Date().toISOString().slice(0, 10),
        priority: request.priority === "urgent" || request.priority === "high"
          ? { urgent: request.priority === "urgent", important: true }
          : undefined,
      });
      if (typeof result === "string") {
        toast({ title: result });
        return;
      }
      await markScheduled(request.id);
      toast({ title: "Scheduled", description: `${request.title} · ${start}–${end}` });
      onResolved(request.id);
    } finally {
      setBusy(false);
    }
  }

  async function dismiss() {
    setBusy(true);
    try {
      await dismissRequest(request.id);
      onResolved(request.id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-md border border-border/60 bg-surface-raised p-3">
      <div className="min-w-0 flex-1">
        <div className="text-sm text-primary truncate">{request.title}</div>
        <div className="text-[11px] text-muted-foreground truncate">
          {request.projectName}{request.dueDate ? ` · due ${request.dueDate}` : ""}{request.priority !== "none" ? ` · ${request.priority}` : ""}
        </div>
      </div>
      <Input
        type="time"
        value={start}
        onChange={(e) => setStart(e.target.value)}
        className="h-8 w-24 text-xs num shrink-0"
        aria-label="Start time"
      />
      <Button size="sm" onClick={schedule} disabled={busy} className="h-8 bg-primary text-primary-foreground hover:bg-primary-deep shrink-0">
        <Check className="h-3.5 w-3.5 mr-1" /> Schedule
      </Button>
      <Button size="icon" variant="ghost" onClick={dismiss} disabled={busy} aria-label="Dismiss" className="h-8 w-8 shrink-0 text-muted-foreground">
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

/** Cloud-only inbox of tasks Kairos asked Chronos to schedule. Renders nothing
 *  when signed out, local-only, or empty — never a placeholder card for a
 *  feature the user isn't using. */
export function KairosInboxCard() {
  const { isCloud, session } = useAuth();
  const [requests, setRequests] = useState<BridgeRequest[]>([]);
  const cloud = isCloud && !!session?.email;

  useEffect(() => {
    if (!cloud) return;
    let cancelled = false;
    void fetchPendingRequests().then((r) => { if (!cancelled) setRequests(r); });
    return () => { cancelled = true; };
  }, [cloud]);

  if (!cloud || requests.length === 0) return null;

  return (
    <div className="chronos-card p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-emerald-600/15 grid place-items-center">
            <CalendarClock className="h-3.5 w-3.5 text-emerald-600" />
          </div>
          <div className="text-sm font-medium text-primary">Kairos inbox</div>
          <span className="text-[10px] font-semibold rounded-full bg-secondary text-primary-deep px-1.5 py-0.5 num">{requests.length}</span>
        </div>
        <a href={KAIROS_URL} target="_blank" rel="noreferrer" className="text-[11px] text-muted-foreground hover:text-primary flex items-center gap-1">
          Open Kairos <ExternalLink className="h-3 w-3" />
        </a>
      </div>
      <p className="text-xs text-muted-foreground mt-1.5">Tasks sent from Kairos, waiting for a slot on the calendar.</p>
      <div className="mt-3 space-y-2">
        {requests.map((r) => (
          <InboxRow key={r.id} request={r} onResolved={(id) => setRequests((rs) => rs.filter((x) => x.id !== id))} />
        ))}
      </div>
    </div>
  );
}
