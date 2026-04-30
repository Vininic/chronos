import { Mail, BookOpen, MessageCircle } from "lucide-react";
import { useT } from "@/lib/i18n/I18nProvider";
export default function Support() {
  const t = useT();
  const icons = [<Mail className="h-5 w-5"/>, <BookOpen className="h-5 w-5"/>, <MessageCircle className="h-5 w-5"/>];
  return (
    <>
      <header className="mb-7">
        <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{t.chronos.support.eyebrow}</div>
        <h1 className="font-display text-4xl text-primary mt-1.5">{t.chronos.support.title}</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">{t.chronos.support.lead}</p>
      </header>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {t.chronos.support.cards.map((c, i) => (
          <div key={c.t} className="chronos-card p-6">
            <div className="h-10 w-10 rounded-md bg-primary text-primary-foreground grid place-items-center">{icons[i]}</div>
            <h3 className="font-display text-xl text-primary mt-3">{c.t}</h3>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{c.b}</p>
          </div>
        ))}
      </div>
      <section className="mt-8 chronos-card p-6">
        <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{t.chronos.support.faqEyebrow}</div>
        <h2 className="font-display text-2xl text-primary mt-1">{t.chronos.support.faqTitle}</h2>
        <div className="mt-5 divide-y divide-border">
          {t.chronos.support.faq.map((q) => (
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
