import { useT } from "@/lib/i18n/I18nProvider";

export default function AIAssistant() {
  const t = useT();
  return (
    <>
      <header className="mb-7">
        <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{t.chronos.nav.aiAssistant}</div>
        <h1 className="font-display text-4xl text-primary mt-1.5">{t.chronos.aetheris.title}</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">{t.chronos.aetheris.lead}</p>
      </header>
      <section className="chronos-card p-6">
        <div className="rounded-md border border-secondary/30 bg-secondary/5 p-4">
          <p className="text-sm text-muted-foreground leading-relaxed">Configure como o Aetheris analisa sua rotina e gera sugestões.</p>
        </div>
      </section>
    </>
  );
}
