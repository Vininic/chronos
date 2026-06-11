import type { BlockKind } from "@/lib/schedule/types";
import { useCallback } from "react";
import { useI18n } from "./I18nProvider";

type LocaleText = { pt: string; en: string };
type Locale = "pt" | "en";

function pickLocale(text: LocaleText, locale: Locale) {
  return text[locale];
}

const cycleNames: Record<string, LocaleText> = {
  "Semana atual": { pt: "Semana atual", en: "Current week" },
  "Current week": { pt: "Semana atual", en: "Current week" },
};

const categoryLabels: Record<BlockKind, LocaleText> = {
  deep: { pt: "Foco", en: "Focus" },
  meeting: { pt: "Reunião", en: "Meeting" },
  ritual: { pt: "Ritual", en: "Ritual" },
  recovery: { pt: "Pausa", en: "Break" },
  shallow: { pt: "Tarefas", en: "Tasks" },
  sleep: { pt: "Sono", en: "Sleep" },
};

const categoryDescriptions: Record<BlockKind, LocaleText> = {
  deep: {
    pt: "Trabalho de alta cognição sem interrupções.",
    en: "Uninterrupted high-cognition work.",
  },
  meeting: {
    pt: "Colaboração síncrona.",
    en: "Synchronous collaboration.",
  },
  ritual: {
    pt: "Prática pessoal recorrente.",
    en: "Recurring personal practice.",
  },
  recovery: {
    pt: "Descanso ativo, caminhadas, respiração.",
    en: "Active rest, walks, breath.",
  },
  shallow: {
    pt: "E-mail, administração e tarefas leves.",
    en: "Email, admin, low-cost tasks.",
  },
  sleep: {
    pt: "Janela de descanso protegida.",
    en: "Protected rest window.",
  },
};

const categoryDescriptionAliases = new Set([
  "Uninterrupted high-cognition work.",
  "Trabalho de alta cognição sem interrupções.",
  "Synchronous collaboration.",
  "Colaboração síncrona.",
  "Recurring personal practice.",
  "Prática pessoal recorrente.",
  "Active rest, walks, breath.",
  "Descanso ativo, caminhadas, respiração.",
  "Email, admin, low-cost tasks.",
  "E-mail, administração e tarefas leves.",
  "Protected rest window.",
  "Janela de descanso protegida.",
]);

const categoryLabelAliases: Record<BlockKind, Set<string>> = {
  deep: new Set(["Foco", "Focus", "Deep work"]),
  meeting: new Set(["Reunião", "Meeting"]),
  ritual: new Set(["Ritual"]),
  recovery: new Set(["Pausa", "Break", "Recovery"]),
  shallow: new Set(["Tarefas", "Tasks", "Shallow"]),
  sleep: new Set(["Sono", "Sleep"]),
};

const blockTitles: Record<string, LocaleText> = {
  "Stoic morning · journaling": { pt: "Manhã estoica · diário", en: "Stoic morning · journaling" },
  "Manhã estoica · diário": { pt: "Manhã estoica · diário", en: "Stoic morning · journaling" },
  "Atlas · strategy memo": { pt: "Atlas · memorando estratégico", en: "Atlas · strategy memo" },
  "Atlas · memorando estratégico": { pt: "Atlas · memorando estratégico", en: "Atlas · strategy memo" },
  "Aurora standup": { pt: "Alinhamento Aurora", en: "Aurora standup" },
  "Alinhamento Aurora": { pt: "Alinhamento Aurora", en: "Aurora standup" },
  "Architectural review": { pt: "Revisão arquitetural", en: "Architectural review" },
  "Revisão arquitetural": { pt: "Revisão arquitetural", en: "Architectural review" },
  Walk: { pt: "Caminhada", en: "Walk" },
  Caminhada: { pt: "Caminhada", en: "Walk" },
  "Stoic morning": { pt: "Manhã estoica", en: "Stoic morning" },
  "Manhã estoica": { pt: "Manhã estoica", en: "Stoic morning" },
  "Quarterly memo": { pt: "Memorando trimestral", en: "Quarterly memo" },
  "Memorando trimestral": { pt: "Memorando trimestral", en: "Quarterly memo" },
  "1:1 · Mira": { pt: "1:1 · Mira", en: "1:1 · Mira" },
  "Atlas block": { pt: "Bloco Atlas", en: "Atlas block" },
  "Bloco Atlas": { pt: "Bloco Atlas", en: "Atlas block" },
  "Investor brief": { pt: "Briefing com investidores", en: "Investor brief" },
  "Briefing com investidores": { pt: "Briefing com investidores", en: "Investor brief" },
  Strategy: { pt: "Estratégia", en: "Strategy" },
  Estratégia: { pt: "Estratégia", en: "Strategy" },
  "Board prep": { pt: "Preparação do conselho", en: "Board prep" },
  "Preparação do conselho": { pt: "Preparação do conselho", en: "Board prep" },
  Correspondence: { pt: "Correspondência", en: "Correspondence" },
  Correspondência: { pt: "Correspondência", en: "Correspondence" },
  "Long walk": { pt: "Caminhada longa", en: "Long walk" },
  "Caminhada longa": { pt: "Caminhada longa", en: "Long walk" },
  "Weekly reflection": { pt: "Revisão semanal", en: "Weekly reflection" },
  "Revisão semanal": { pt: "Revisão semanal", en: "Weekly reflection" },
  "Investor brief · Meridian": { pt: "Briefing com investidores · Meridian", en: "Investor brief · Meridian" },
  "Briefing com investidores · Meridian": { pt: "Briefing com investidores · Meridian", en: "Investor brief · Meridian" },
  "Board sync": { pt: "Alinhamento do conselho", en: "Board sync" },
  "Alinhamento do conselho": { pt: "Alinhamento do conselho", en: "Board sync" },
  "Hiring panel · Aetheris": { pt: "Painel de contratação · Aetheris", en: "Hiring panel · Aetheris" },
  "Painel de contratação · Aetheris": { pt: "Painel de contratação · Aetheris", en: "Hiring panel · Aetheris" },
};

export function getDefaultCategoryLabel(kind: BlockKind, locale: Locale) {
  return pickLocale(categoryLabels[kind], locale);
}

export function getDefaultCategoryDescription(kind: BlockKind, locale: Locale) {
  return pickLocale(categoryDescriptions[kind], locale);
}

export function isDefaultCategoryLabel(kind: BlockKind, label: string) {
  return categoryLabelAliases[kind]?.has(label) ?? false;
}

export function isDefaultCategoryDescription(description: string) {
  return categoryDescriptionAliases.has(description);
}

export function localizeCategoryLabel(kind: BlockKind, label: string, locale: Locale, customLabel?: string) {
  if (customLabel?.trim()) return customLabel;
  if (categoryLabels[kind] && isDefaultCategoryLabel(kind, label)) return pickLocale(categoryLabels[kind], locale);
  return label;
}

export function localizeCategoryDescription(kind: BlockKind, description: string, locale: Locale, customDescription?: string) {
  if (customDescription?.trim()) return customDescription;
  if (categoryDescriptions[kind] && isDefaultCategoryDescription(description)) return pickLocale(categoryDescriptions[kind], locale);
  return description;
}

export function isKnownDefaultBlockTitle(title: string) {
  return Boolean(blockTitles[title]);
}

export function localizeBlockTitle(title: string, locale: Locale, customTitle?: string) {
  if (customTitle?.trim()) return customTitle;
  return blockTitles[title]?.[locale] ?? title;
}

export function useScheduleText() {
  const { locale } = useI18n();

  const cycleName = useCallback(
    (name: string) => cycleNames[name]?.[locale] ?? name,
    [locale],
  );

  const categoryLabel = useCallback(
    (kind: BlockKind, label: string, customLabel?: string) => localizeCategoryLabel(kind, label, locale, customLabel),
    [locale],
  );

  const categoryDescription = useCallback(
    (kind: BlockKind, description: string, customDescription?: string) =>
      localizeCategoryDescription(kind, description, locale, customDescription),
    [locale],
  );

  const blockTitle = useCallback(
    (title: string, customTitle?: string) => localizeBlockTitle(title, locale, customTitle),
    [locale],
  );

  return {
    cycleName,
    categoryLabel,
    categoryDescription,
    blockTitle,
  };
}