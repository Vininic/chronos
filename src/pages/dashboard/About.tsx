import { ExternalLink, Github, Linkedin, Mail, Code2, Layers3, Boxes, Cloud, HelpCircle } from "lucide-react";
import { useT } from "@/lib/i18n/I18nProvider";

const GITHUB_URL = "https://github.com/Vininic";
const LINKEDIN_URL = "https://www.linkedin.com/in/vin%C3%ADcius-nicoluci-esp%C3%ADndola-564069321/";
const EMAIL = "vininicespindola@gmail.com";

const STACK_ICONS = [
  <Code2 className="h-5 w-5" />,
  <Layers3 className="h-5 w-5" />,
  <Boxes className="h-5 w-5" />,
  <Cloud className="h-5 w-5" />,
];

export default function Support() {
  const t = useT();
  const s = t.chronos.support;

  return (
    <>
      <header className="mb-7">
        <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{s.eyebrow}</div>
        <h1 className="font-display text-4xl text-primary mt-1.5">{s.title}</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">{s.lead}</p>
      </header>

      <section className="chronos-card p-6">
        <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{s.projectEyebrow}</div>
        <h2 className="font-display text-2xl text-primary mt-1">{s.projectTitle}</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-3xl leading-relaxed">{s.projectLead}</p>
      </section>

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {s.stack.map((c, i) => (
          <div key={c.name} className="chronos-card p-6">
            <div className="h-10 w-10 rounded-md bg-primary text-primary-foreground grid place-items-center">
              {STACK_ICONS[i] ?? <Code2 className="h-5 w-5" />}
            </div>
            <h3 className="font-display text-lg text-primary mt-3">{c.name}</h3>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{c.desc}</p>
          </div>
        ))}
      </div>

      <section className="mt-8 chronos-card p-6">
        <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{s.linksEyebrow}</div>
        <h2 className="font-display text-2xl text-primary mt-1">{s.linksTitle}</h2>
        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
          <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="rounded-md border border-border/60 bg-surface-raised p-3 hover:border-secondary/40 transition-colors">
            <div className="flex items-center gap-2 text-primary"><Github className="h-4 w-4" /> {s.links[0].label} <ExternalLink className="h-3.5 w-3.5 ml-auto text-muted-foreground" /></div>
            <p className="text-xs text-muted-foreground mt-1">{s.links[0].body}</p>
            <p className="text-[11px] text-secondary mt-1 num">github.com/Vininic</p>
          </a>
          <a href={LINKEDIN_URL} target="_blank" rel="noreferrer" className="rounded-md border border-border/60 bg-surface-raised p-3 hover:border-secondary/40 transition-colors">
            <div className="flex items-center gap-2 text-primary"><Linkedin className="h-4 w-4" /> {s.links[1].label} <ExternalLink className="h-3.5 w-3.5 ml-auto text-muted-foreground" /></div>
            <p className="text-xs text-muted-foreground mt-1">{s.links[1].body}</p>
            <p className="text-[11px] text-secondary mt-1">Vinícius Nicoluci Espíndola</p>
          </a>
          <a href={`mailto:${EMAIL}`} className="rounded-md border border-border/60 bg-surface-raised p-3 hover:border-secondary/40 transition-colors">
            <div className="flex items-center gap-2 text-primary"><Mail className="h-4 w-4" /> {s.links[2].label} <ExternalLink className="h-3.5 w-3.5 ml-auto text-muted-foreground" /></div>
            <p className="text-xs text-muted-foreground mt-1">{s.links[2].body}</p>
            <p className="text-[11px] text-secondary mt-1 num">{EMAIL}</p>
          </a>
        </div>
      </section>

      <section className="mt-8 chronos-card p-6">
        <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{s.faqEyebrow}</div>
        <h2 className="font-display text-2xl text-primary mt-1">{s.faqTitle}</h2>
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
          {s.faq.map((item) => (
            <div key={item.q} className="flex gap-3">
              <HelpCircle className="h-4 w-4 text-secondary shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-primary">{item.q}</p>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{item.a}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
