import { useRef } from "react";
import { useSchedule } from "@/lib/schedule/store";
import { useAuth } from "@/lib/auth";
import { exportToICS, exportToJSON, exportToXLSX } from "@/lib/schedule/export";
import { Button } from "@/components/ui/button";
import { Download, CalendarDays, FileJson, RotateCcw, Upload, LogOut } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useT } from "@/lib/i18n/I18nProvider";
import { LanguageToggle } from "@/components/suite/LanguageToggle";
import { ThemeToggle } from "@/components/suite/ThemeToggle";

export default function Settings() {
  const { data, resetToSeed, replace } = useSchedule();
  const { session, signOut } = useAuth();
  const t = useT();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  function importJSON(file: File) {
    file.text().then((txt) => {
      try {
        const next = JSON.parse(txt);
        if (!next.routine || !Array.isArray(next.routine)) throw new Error("Invalid file");
        replace(next); toast({ title: t.chronos.settings.imported });
      } catch (e: any) { toast({ title: t.chronos.settings.importFail, description: e.message ?? String(e) }); }
    });
  }
  return (
    <>
      <header className="mb-7">
        <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{t.chronos.settings.eyebrow}</div>
        <h1 className="font-display text-4xl text-primary mt-1.5">{t.chronos.settings.title}</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">{t.chronos.settings.lead}</p>
      </header>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section title={t.chronos.settings.account} eyebrow={t.chronos.settings.identity}>
          <Row label={t.chronos.settings.composer} value={session?.name ?? "—"} />
          <Row label={t.chronos.settings.email} value={session?.email ?? "—"} />
          <Row label={t.chronos.settings.cycle} value={`${data.meta.cycle.name} · #${data.meta.cycle.number}`} />
          <Button variant="outline" onClick={() => { signOut(); navigate("/login"); }}><LogOut className="h-4 w-4 mr-1.5" /> {t.common.signOut}</Button>
        </Section>
        <Section title={t.chronos.settings.preferences} eyebrow={t.chronos.settings.appearance}>
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <span className="text-sm text-muted-foreground">{t.chronos.settings.languageLabel}</span>
            <LanguageToggle />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t.chronos.settings.themeLabel}</span>
            <ThemeToggle />
          </div>
        </Section>
        <Section title={t.chronos.settings.export} eyebrow={t.chronos.settings.portability}>
          <p className="text-sm text-muted-foreground">{t.chronos.settings.exportLead}</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
            <Button onClick={() => { exportToXLSX(data); toast({ title: t.chronos.settings.xlsxExported }); }}><Download className="h-4 w-4 mr-1.5" /> XLSX</Button>
            <Button variant="outline" onClick={() => { exportToICS(data); toast({ title: t.chronos.settings.icsExported }); }}><CalendarDays className="h-4 w-4 mr-1.5" /> ICS</Button>
            <Button variant="outline" onClick={() => { exportToJSON(data); toast({ title: t.chronos.settings.jsonExported }); }}><FileJson className="h-4 w-4 mr-1.5" /> JSON</Button>
          </div>
        </Section>
        <Section title={t.chronos.settings.scheduleData} eyebrow={t.chronos.settings.sourceOfTruth}>
          <p className="text-sm text-muted-foreground">{t.chronos.settings.scheduleLead}</p>
          <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importJSON(f); e.currentTarget.value = ""; }} />
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4 mr-1.5" /> {t.chronos.settings.importJSON}</Button>
            <Button variant="outline" onClick={() => { resetToSeed(); toast({ title: t.chronos.settings.resetDone }); }}><RotateCcw className="h-4 w-4 mr-1.5" /> {t.chronos.settings.reset}</Button>
          </div>
        </Section>
        <Section title={t.chronos.settings.categories} eyebrow={t.chronos.settings.vocabulary}>
          <ul className="space-y-2 text-sm">
            {data.categories.map((c) => (
              <li key={c.id} className="flex items-start gap-3 border-b border-border/60 pb-2">
                <div className="text-primary font-medium w-24">{t.common.kinds[c.id]}</div>
                <div className="text-muted-foreground flex-1">{c.description}</div>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </>
  );
}
function Section({ title, eyebrow, children }: { title: string; eyebrow: string; children: React.ReactNode }) {
  return (<section className="chronos-card p-6 space-y-4"><div><div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{eyebrow}</div><h2 className="font-display text-2xl text-primary mt-0.5">{title}</h2></div>{children}</section>);
}
function Row({ label, value }: { label: string; value: string }) {
  return (<div className="flex items-center justify-between border-b border-border/60 pb-2 text-sm"><span className="text-muted-foreground">{label}</span><span className="text-primary font-medium">{value}</span></div>);
}
