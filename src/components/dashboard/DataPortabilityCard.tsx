import { useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Database, FileJson, FileSpreadsheet, Calendar, Upload, Loader2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { useSchedule } from "@/lib/schedule/store";
import { useT, useI18n } from "@/lib/i18n/I18nProvider";
import { exportToJSON, exportToXLSX, exportToICS } from "@/lib/schedule/export";
import { parseChronosWorkbook, workbookToText, aiImportToSchedule } from "@/lib/schedule/import";
import { isProviderConfigured, loadSettingsSync } from "@/lib/ai/settings/store";

export default function DataPortabilityCard() {
  const { data, replace } = useSchedule();
  const t = useT();
  const { locale } = useI18n();
  const d = t.chronos.settingsPage.data;
  const settingsT = t.chronos.settings;
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const aiConfigured = isProviderConfigured(loadSettingsSync().providerId);

  async function handleFile(file: File) {
    const name = file.name.toLowerCase();
    setImporting(true);
    try {
      if (name.endsWith(".json")) {
        const next = JSON.parse(await file.text());
        if (!next.routine || !Array.isArray(next.routine)) throw new Error(d.importFail);
        replace(next);
        toast({ title: d.importedOk });
        return;
      }
      if (name.endsWith(".xlsx")) {
        const buf = await file.arrayBuffer();
        const chronos = await parseChronosWorkbook(buf);
        if (chronos) { replace(chronos); toast({ title: d.importedOk }); return; }
        if (!aiConfigured) {
          toast({ title: d.importFail, description: `${d.notChronos} ${d.aiNeeded}`, variant: "destructive" });
          return;
        }
        const next = await aiImportToSchedule(await workbookToText(buf));
        replace(next);
        toast({ title: d.importedOk });
        return;
      }
      // .csv / .txt / anything else → AI interpretation
      if (!aiConfigured) {
        toast({ title: d.importFail, description: d.aiNeeded, variant: "destructive" });
        return;
      }
      const next = await aiImportToSchedule(await file.text());
      replace(next);
      toast({ title: d.importedOk });
    } catch (e) {
      const msg = e instanceof Error && e.message === "no-provider" ? d.aiNeeded
        : e instanceof Error ? e.message : String(e);
      toast({ title: d.importFail, description: msg, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Database className="h-4 w-4 text-muted-foreground" />
          {d.title}
        </CardTitle>
        <CardDescription>{d.desc}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-2">{d.export}</div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => { exportToJSON(data); toast({ title: settingsT.jsonExported }); }}>
              <FileJson className="h-3.5 w-3.5 mr-1.5 text-amber-400" /> JSON
            </Button>
            <Button variant="outline" size="sm" onClick={async () => { await exportToXLSX(data, undefined, locale); toast({ title: settingsT.xlsxExported }); }}>
              <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5 text-emerald-400" /> XLSX
            </Button>
            <Button variant="outline" size="sm" onClick={() => { exportToICS(data); toast({ title: settingsT.icsExported }); }}>
              <Calendar className="h-3.5 w-3.5 mr-1.5 text-violet-400" /> ICS
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground/70 mt-2">{d.xlsxHint}</p>
        </div>

        <div className="border-t border-border/60" />

        <div>
          <div className="text-xs font-medium text-muted-foreground mb-2">{d.import}</div>
          <Button variant="outline" size="sm" disabled={importing} onClick={() => fileRef.current?.click()}>
            {importing ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1.5" />}
            {importing ? d.importing : d.importFile}
          </Button>
          <p className="text-[11px] text-muted-foreground/70 mt-2">{d.hint}</p>
          <input
            ref={fileRef}
            type="file"
            accept=".json,.xlsx,.csv,.txt"
            hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.currentTarget.value = ""; }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
