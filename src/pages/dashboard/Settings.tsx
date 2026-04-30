import { useRef } from "react";
import { useSchedule } from "@/lib/schedule/store";
import { useAuth } from "@/lib/auth";
import { exportToICS, exportToJSON, exportToXLSX } from "@/lib/schedule/export";
import { Button } from "@/components/ui/button";
import { Download, CalendarDays, FileJson, RotateCcw, Upload, LogOut } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

export default function Settings() {
  const { data, resetToSeed, replace } = useSchedule();
  const { session, signOut } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  function importJSON(file: File) {
    file.text().then((txt) => {
      try {
        const next = JSON.parse(txt);
        if (!next.routine || !Array.isArray(next.routine)) throw new Error("Invalid file");
        replace(next); toast({ title: "Schedule imported" });
      } catch (e: any) { toast({ title: "Could not import", description: e.message ?? String(e) }); }
    });
  }
  return (
    <>
      <header className="mb-7">
        <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">Settings</div>
        <h1 className="font-display text-4xl text-primary mt-1.5">The atelier preferences</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">Manage your account, exports, and the underlying schedule data.</p>
      </header>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section title="Account" eyebrow="Identity">
          <Row label="Composer" value={session?.name ?? "—"} />
          <Row label="Email" value={session?.email ?? "—"} />
          <Row label="Cycle" value={`${data.meta.cycle.name} · #${data.meta.cycle.number}`} />
          <Button variant="outline" onClick={() => { signOut(); navigate("/login"); }}><LogOut className="h-4 w-4 mr-1.5" /> Sign out</Button>
        </Section>
        <Section title="Export" eyebrow="Portability">
          <p className="text-sm text-muted-foreground">XLSX has Weekly Routine, Commitments, Focus Blocks, Categories and Metadata sheets.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
            <Button onClick={() => { exportToXLSX(data); toast({ title: "XLSX exported" }); }}><Download className="h-4 w-4 mr-1.5" /> XLSX</Button>
            <Button variant="outline" onClick={() => { exportToICS(data); toast({ title: "ICS exported" }); }}><CalendarDays className="h-4 w-4 mr-1.5" /> ICS</Button>
            <Button variant="outline" onClick={() => { exportToJSON(data); toast({ title: "JSON exported" }); }}><FileJson className="h-4 w-4 mr-1.5" /> JSON</Button>
          </div>
        </Section>
        <Section title="Schedule data" eyebrow="Source of truth">
          <p className="text-sm text-muted-foreground">All schedule data is driven from a single JSON file. Import or reset to the seeded composition.</p>
          <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importJSON(f); e.currentTarget.value = ""; }} />
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4 mr-1.5" /> Import JSON</Button>
            <Button variant="outline" onClick={() => { resetToSeed(); toast({ title: "Reset" }); }}><RotateCcw className="h-4 w-4 mr-1.5" /> Reset to seed</Button>
          </div>
        </Section>
        <Section title="Categories" eyebrow="Vocabulary">
          <ul className="space-y-2 text-sm">
            {data.categories.map((c) => (
              <li key={c.id} className="flex items-start gap-3 border-b border-border/60 pb-2">
                <div className="text-primary font-medium w-24">{c.label}</div>
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
