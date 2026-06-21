import { useSyncExternalStore } from "react";
import { getLogs, clearLogs, type LLMCallLog } from "@/lib/ai/core/logger";
import { getAllFeedback, clearAllFeedback } from "@/lib/ai/metrics/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BarChart3, Clock, Zap, ThumbsUp, ThumbsDown, Trash2 } from "lucide-react";

let _logSnapshot: LLMCallLog[] = [];

function subscribe(cb: () => void): () => void {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
}

function readLogs(): LLMCallLog[] {
  const next = getLogs();
  if (
    next.length !== _logSnapshot.length ||
    next.some((e, i) => e !== _logSnapshot[i])
  ) {
    _logSnapshot = next;
  }
  return _logSnapshot;
}

export default function AetherisMetrics({ compact }: { compact?: boolean }) {
  const logs = useSyncExternalStore(subscribe, readLogs);
  const feedback = getAllFeedback();

  const totalCalls = logs.length;
  const avgLatency = totalCalls > 0
    ? Math.round(logs.reduce((s, l) => s + l.latencyMs, 0) / totalCalls)
    : 0;
  const totalTokens = logs.reduce((s, l) => s + l.tokenEstimate, 0);

  const versionCounts: Record<string, { calls: number; latency: number[] }> = {};
  for (const log of logs) {
    const v = log.promptVersion || "unknown";
    if (!versionCounts[v]) versionCounts[v] = { calls: 0, latency: [] };
    versionCounts[v].calls++;
    versionCounts[v].latency.push(log.latencyMs);
  }

  const totalFeedback = feedback.length;
  const upCount = feedback.filter((f) => f.vote === "up").length;
  const downCount = feedback.filter((f) => f.vote === "down").length;
  const acceptanceRate = totalFeedback > 0 ? Math.round((upCount / totalFeedback) * 100) : 0;

  return (
    <div className={compact ? 'space-y-3' : 'mx-auto max-w-3xl space-y-6 p-6'}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-6 w-6 text-muted-foreground" />
          <h1 className={compact ? "text-base font-bold" : "text-2xl font-bold"}>AI Performance</h1>
        </div>
        <div className="flex gap-1">
          {compact ? (
            <>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { clearAllFeedback(); window.dispatchEvent(new Event("storage")); }} title="Clear feedback">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { clearLogs(); window.dispatchEvent(new Event("storage")); }} title="Clear logs">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => { clearAllFeedback(); window.dispatchEvent(new Event("storage")); }}>
                <Trash2 className="mr-2 h-4 w-4" /> Clear Feedback
              </Button>
              <Button variant="outline" size="sm" onClick={() => { clearLogs(); window.dispatchEvent(new Event("storage")); }}>
                <Trash2 className="mr-2 h-4 w-4" /> Clear Logs
              </Button>
            </>
          )}
        </div>
      </div>

      <div className={compact ? 'grid grid-cols-2 gap-2' : 'grid grid-cols-2 gap-4 sm:grid-cols-4'}>
        {[
          { icon: Zap, label: "Total Calls", value: totalCalls },
          { icon: Clock, label: "Avg Latency", value: `${avgLatency}ms` },
          { icon: Clock, label: "Tokens Used", value: `~${totalTokens.toLocaleString()}` },
          { icon: ThumbsUp, label: "Acceptance", value: `${acceptanceRate}%` },
        ].map(({ icon: Icon, label, value }) => (
          <Card key={label}>
            <CardHeader className={compact ? 'pb-1 p-2' : 'pb-2'}>
              <CardTitle className={`flex items-center gap-2 ${compact ? 'text-[10px]' : 'text-sm'} font-medium`}>
                <Icon className={`${compact ? 'h-3 w-3' : 'h-4 w-4'} text-muted-foreground`} />
                {label}
              </CardTitle>
            </CardHeader>
            <CardContent className={compact ? 'p-2 pt-0' : ''}>
              <p className={`${compact ? 'text-base' : 'text-2xl'} font-bold`}>{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className={compact ? 'p-3 pb-1' : ''}>
          <CardTitle className={compact ? 'text-[11px] font-medium' : 'text-sm font-medium'}>Prompt Versions</CardTitle>
        </CardHeader>
        <CardContent className={compact ? 'p-3 pt-0' : ''}>
          {Object.keys(versionCounts).length === 0 ? (
            <p className="text-sm text-muted-foreground">No data yet.</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(versionCounts).map(([version, data]) => {
                const avgV = data.latency.length > 0
                  ? Math.round(data.latency.reduce((a, b) => a + b, 0) / data.latency.length)
                  : 0;
                return (
                  <div key={version} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={compact ? 'text-[9px] px-1' : ''}>{version}</Badge>
                      <span className={compact ? 'text-[10px] text-muted-foreground' : 'text-sm text-muted-foreground'}>
                        {data.calls} calls
                      </span>
                    </div>
                    <span className={compact ? 'text-[10px] text-muted-foreground' : 'text-sm text-muted-foreground'}>{avgV}ms avg</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className={compact ? 'p-3 pb-1' : ''}>
          <CardTitle className={compact ? 'text-[11px] font-medium' : 'text-sm font-medium'}>Suggestion Feedback</CardTitle>
        </CardHeader>
        <CardContent className={compact ? 'p-3 pt-0' : ''}>
          {totalFeedback === 0 ? (
            <p className={compact ? 'text-[11px] text-muted-foreground' : 'text-sm text-muted-foreground'}>No feedback recorded yet.</p>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <ThumbsUp className={compact ? 'h-3 w-3 text-emerald-500' : 'h-4 w-4 text-emerald-500'} />
                <span className={compact ? 'text-[11px]' : 'text-sm'}>{upCount} up</span>
              </div>
              <div className="flex items-center gap-1.5">
                <ThumbsDown className={compact ? 'h-3 w-3 text-red-500' : 'h-4 w-4 text-red-500'} />
                <span className={compact ? 'text-[11px]' : 'text-sm'}>{downCount} down</span>
              </div>
              <div className={compact ? 'text-[11px] text-muted-foreground' : 'text-sm text-muted-foreground'}>
                {acceptanceRate}% acceptance rate
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {logs.length > 0 && (
        <Card>
          <CardHeader className={compact ? 'p-3 pb-1' : ''}>
            <CardTitle className={compact ? 'text-[11px] font-medium' : 'text-sm font-medium'}>Recent Calls</CardTitle>
          </CardHeader>
          <CardContent className={compact ? 'p-3 pt-0' : ''}>
            <ScrollArea className={compact ? 'max-h-40' : 'h-48'}>
              <div className="space-y-1.5">
                {[...logs].reverse().slice(0, 20).map((log) => (
                  <div key={log.id} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[9px]">{log.promptVersion || "?"}</Badge>
                      <span className="text-muted-foreground text-[10px]">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {log.selfEval && (
                        <span className={`text-[10px] ${log.selfEval.overall >= 80 ? "text-emerald-500" : log.selfEval.overall >= 50 ? "text-amber-500" : "text-red-500"}`}>
                          {log.selfEval.overall}/100
                        </span>
                      )}
                      <span className="text-muted-foreground text-[10px]">{log.latencyMs}ms</span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
