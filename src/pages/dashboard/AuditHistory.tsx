import { useState, useSyncExternalStore } from "react";
import { useSchedule } from "@/lib/schedule/store";
import { getAuditLog, markUndone, clearAuditLog, type AuditEntry } from "@/lib/ai/audit/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Undo2, Trash2, Clock, History } from "lucide-react";

let _snapshot: AuditEntry[] = [];

function subscribeAuditLog(cb: () => void): () => void {
  const handler = (): void => cb();
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}

function readAuditLog(): AuditEntry[] {
  const next = getAuditLog();
  if (
    next.length !== _snapshot.length ||
    next.some((e, i) => e !== _snapshot[i])
  ) {
    _snapshot = next;
  }
  return _snapshot;
}

export default function AuditHistory({ compact }: { compact?: boolean }) {
  const entries = useSyncExternalStore(subscribeAuditLog, readAuditLog);
  const { replace } = useSchedule();
  const [revertId, setRevertId] = useState<string | null>(null);

  const handleRevert = (entry: AuditEntry): void => {
    if (entry.scheduleSnapshot) {
      replace(entry.scheduleSnapshot);
      markUndone(entry.id, entry.scheduleSnapshot);
    }
    setRevertId(null);
  };

  const handleClear = (): void => {
    clearAuditLog();
  };

  return (
    <div className={compact ? 'space-y-3' : 'mx-auto max-w-3xl space-y-6 p-6'}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <History className="h-6 w-6 text-muted-foreground" />
          <h1 className={compact ? "text-base font-bold" : "text-2xl font-bold"}>Action History</h1>
        </div>
        {entries.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Trash2 className="mr-2 h-4 w-4" />
                Clear All
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear history?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes all logged actions. They cannot be recovered.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleClear}>Clear</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {entries.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
            <Clock className="h-12 w-12" />
            <p className="text-lg font-medium">No actions yet</p>
            <p className="text-sm">
              Actions performed by Aetheris will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className={compact ? 'max-h-60' : 'h-[70vh]'}>
          <div className="space-y-3">
            {[...entries].reverse().map((entry) => (
              <Card key={entry.id} className={entry.undone ? "opacity-50" : ""}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-base font-medium">
                        {entry.description}
                      </CardTitle>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <time dateTime={entry.timestamp}>
                          {new Date(entry.timestamp).toLocaleString()}
                        </time>
                        <Badge variant="outline" className="text-[10px]">
                          {entry.tool}
                        </Badge>
                        {entry.undone && (
                          <Badge variant="secondary" className="text-[10px]">
                            Reverted
                          </Badge>
                        )}
                      </div>
                    </div>
                    {!entry.undone && entry.scheduleSnapshot && (
                      <AlertDialog
                        open={revertId === entry.id}
                        onOpenChange={(open) => setRevertId(open ? entry.id : null)}
                      >
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Undo2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Revert this action?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This restores the schedule to how it was before this action.
                              Any changes made after this action will be lost.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleRevert(entry)}>
                              Revert
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
