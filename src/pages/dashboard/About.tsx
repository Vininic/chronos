import { ExternalLink, Github, Linkedin, Mail, Code2, Layers3 } from "lucide-react";
import { useT } from "@/lib/i18n/I18nProvider";
export default function Support() {
  const t = useT();
  const stack = [
    { ...t.chronos.support.stack[0], icon: <Code2 className="h-5 w-5" /> },
    { ...t.chronos.support.stack[1], icon: <Layers3 className="h-5 w-5" /> },
    { ...t.chronos.support.stack[2], icon: <Code2 className="h-5 w-5" /> },
  ];
  return (
    <>
      <header className="mb-7">
        <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{t.chronos.support.eyebrow}</div>
        <h1 className="font-display text-4xl text-primary mt-1.5">{t.chronos.support.title}</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">{t.chronos.support.lead}</p>
      </header>
      <section className="chronos-card p-6">
        <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{t.chronos.support.projectEyebrow}</div>
        <h2 className="font-display text-2xl text-primary mt-1">{t.chronos.support.projectTitle}</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-3xl">
          {t.chronos.support.projectLead}
        </p>
      </section>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        {stack.map((c) => (
          <div key={c.name} className="chronos-card p-6">
            <div className="h-10 w-10 rounded-md bg-primary text-primary-foreground grid place-items-center">{c.icon}</div>
            <h3 className="font-display text-xl text-primary mt-3">{c.name}</h3>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{c.desc}</p>
          </div>
        ))}
      </div>

      <section className="mt-8 chronos-card p-6">
        <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{t.chronos.support.linksEyebrow}</div>
        <h2 className="font-display text-2xl text-primary mt-1">{t.chronos.support.linksTitle}</h2>
        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
          <a href="https://github.com/" target="_blank" rel="noreferrer" className="rounded-md border border-border/60 bg-surface-raised p-3 hover:border-secondary/40 transition-colors">
            <div className="flex items-center gap-2 text-primary"><Github className="h-4 w-4" /> {t.chronos.support.links[0].label} <ExternalLink className="h-3.5 w-3.5 ml-auto text-muted-foreground" /></div>
            <p className="text-xs text-muted-foreground mt-1">{t.chronos.support.links[0].body}</p>
          </a>
          <a href="https://www.linkedin.com/" target="_blank" rel="noreferrer" className="rounded-md border border-border/60 bg-surface-raised p-3 hover:border-secondary/40 transition-colors">
            <div className="flex items-center gap-2 text-primary"><Linkedin className="h-4 w-4" /> {t.chronos.support.links[1].label} <ExternalLink className="h-3.5 w-3.5 ml-auto text-muted-foreground" /></div>
            <p className="text-xs text-muted-foreground mt-1">{t.chronos.support.links[1].body}</p>
          </a>
          <a href="mailto:hello@example.com" className="rounded-md border border-border/60 bg-surface-raised p-3 hover:border-secondary/40 transition-colors">
            <div className="flex items-center gap-2 text-primary"><Mail className="h-4 w-4" /> {t.chronos.support.links[2].label} <ExternalLink className="h-3.5 w-3.5 ml-auto text-muted-foreground" /></div>
            <p className="text-xs text-muted-foreground mt-1">{t.chronos.support.links[2].body}</p>
          </a>
        </div>
      </section>
    </>
  );
}
