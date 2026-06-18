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

export default function AetherisMetrics() {
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
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-bold">AI Performance</h1>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { clearAllFeedback(); window.dispatchEvent(new Event("storage")); }}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Clear Feedback
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { clearLogs(); window.dispatchEvent(new Event("storage")); }}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Clear Logs
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Zap className="h-4 w-4 text-muted-foreground" />
              Total Calls
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalCalls}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Avg Latency
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{avgLatency}ms</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Tokens Used
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">~{totalTokens.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <ThumbsUp className="h-4 w-4 text-muted-foreground" />
              Acceptance Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{acceptanceRate}%</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Prompt Versions</CardTitle>
        </CardHeader>
        <CardContent>
          {Object.keys(versionCounts).length === 0 ? (
            <p className="text-sm text-muted-foreground">No data yet.</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(versionCounts).map(([version, data]) => {
                const avgV = data.latency.length > 0
                  ? Math.round(data.latency.reduce((a, b) => a + b, 0) / data.latency.length)
                  : 0;
                return (
                  <div key={version} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{version}</Badge>
                      <span className="text-sm text-muted-foreground">
                        {data.calls} calls
                      </span>
                    </div>
                    <span className="text-sm text-muted-foreground">{avgV}ms avg</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Suggestion Feedback</CardTitle>
        </CardHeader>
        <CardContent>
          {totalFeedback === 0 ? (
            <p className="text-sm text-muted-foreground">No feedback recorded yet.</p>
          ) : (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <ThumbsUp className="h-4 w-4 text-emerald-500" />
                <span className="text-sm">{upCount} up</span>
              </div>
              <div className="flex items-center gap-2">
                <ThumbsDown className="h-4 w-4 text-red-500" />
                <span className="text-sm">{downCount} down</span>
              </div>
              <div className="text-sm text-muted-foreground">
                {acceptanceRate}% acceptance rate
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {logs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Recent Calls</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-48">
              <div className="space-y-2">
                {[...logs].reverse().slice(0, 20).map((log) => (
                  <div key={log.id} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[9px]">
                        {log.promptVersion || "?"}
                      </Badge>
                      <span className="text-muted-foreground">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {log.selfEval && (
                        <span className={`text-[10px] ${log.selfEval.overall >= 80 ? "text-emerald-500" : log.selfEval.overall >= 50 ? "text-amber-500" : "text-red-500"}`}>
                          {log.selfEval.overall}/100
                        </span>
                      )}
                      <span className="text-muted-foreground">{log.latencyMs}ms</span>
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
