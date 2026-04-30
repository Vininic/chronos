import { Mail, BookOpen, MessageCircle } from "lucide-react";
export default function Support() {
  return (
    <>
      <header className="mb-7">
        <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">Support</div>
        <h1 className="font-display text-4xl text-primary mt-1.5">Counsel & correspondence</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">A measured response, usually within a single working cycle.</p>
      </header>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[{i:<Mail className="h-5 w-5"/>,t:"Write to us",b:"atelier@chronos.app — we read every letter."},{i:<BookOpen className="h-5 w-5"/>,t:"The handbook",b:"Patterns and worked examples for composing routine."},{i:<MessageCircle className="h-5 w-5"/>,t:"Composer's circle",b:"An invitation-only forum for serious practitioners."}].map((c) => (
          <div key={c.t} className="chronos-card p-6">
            <div className="h-10 w-10 rounded-md bg-primary text-primary-foreground grid place-items-center">{c.i}</div>
            <h3 className="font-display text-xl text-primary mt-3">{c.t}</h3>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{c.b}</p>
          </div>
        ))}
      </div>
      <section className="mt-8 chronos-card p-6">
        <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">Frequently asked</div>
        <h2 className="font-display text-2xl text-primary mt-1">Quiet answers</h2>
        <div className="mt-5 divide-y divide-border">
          {[{q:"Is my data sent anywhere?",a:"No. All routine and commitment data lives in your browser's local storage."},{q:"Can I export to my calendar?",a:"Yes — Settings → Export ICS produces a standard .ics file."},{q:"How does the XLSX export look?",a:"Five sheets: Weekly Routine, Commitments, Focus Blocks, Categories, Metadata."},{q:"Where do AI suggestions come from?",a:"Aetheris uses a deterministic ruleset over the schedule JSON."}].map((q) => (
            <details key={q.q} className="group py-4">
              <summary className="cursor-pointer list-none flex items-center justify-between"><span className="text-primary font-medium">{q.q}</span><span className="text-secondary text-sm group-open:rotate-45 transition-transform">+</span></summary>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{q.a}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
