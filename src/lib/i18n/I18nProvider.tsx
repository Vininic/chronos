import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_LOCALE, DICTIONARIES, LOCALE_LABELS, Locale, SUPPORTED_LOCALES, type Dictionary } from "./dictionaries";

/**
 * Suite-wide internationalization provider.
 *
 * Reusable across Chronos / Pluto / Hermes by passing the right namespace
 * to `useT(namespace)` (e.g. `useT("chronos")`, `useT("pluto")`).
 *
 * Persists the selected locale to localStorage under `suite.locale`.
 */

const STORAGE_KEY = "suite.locale";

interface I18nContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  dict: Dictionary;
  /** BCP-47 tag, e.g. "pt-BR", "en-US" — for Intl.* APIs. */
  bcp47: string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function readStoredLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored && (SUPPORTED_LOCALES as readonly string[]).includes(stored)) return stored as Locale;
  return DEFAULT_LOCALE;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => readStoredLocale());

  useEffect(() => {
    document.documentElement.lang = LOCALE_LABELS[locale].bcp47;
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try { window.localStorage.setItem(STORAGE_KEY, l); } catch { /* noop */ }
  }, []);

  const value = useMemo<I18nContextValue>(() => ({
    locale,
    setLocale,
    dict: DICTIONARIES[locale],
    bcp47: LOCALE_LABELS[locale].bcp47,
  }), [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export type { Locale };

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}

/** Common namespace helper. */
export function useT() {
  const { dict } = useI18n();
  return dict;
}

/* ------------------------------ formatting ------------------------------ */

export function useDateFormat() {
  const { bcp47 } = useI18n();
  return useMemo(() => ({
    /** "Quinta-feira, 30 de abril" / "Thursday, April 30" */
    long: (d: Date) =>
      new Intl.DateTimeFormat(bcp47, { weekday: "long", month: "long", day: "numeric" }).format(d),
    /** "30/04/2026" / "4/30/2026" */
    short: (d: Date) =>
      new Intl.DateTimeFormat(bcp47, { dateStyle: "short" }).format(d),
    /** ISO yyyy-mm-dd → localized short date. */
    fromISO: (iso: string) => {
      const d = new Date(iso + "T00:00:00");
      return new Intl.DateTimeFormat(bcp47, { dateStyle: "medium" }).format(d);
    },
  }), [bcp47]);
}

/** Hour:minute → localized "Xh Ym" / "Xh Ymin". Keeps suite-wide formatting consistent. */
export function useFmtDur() {
  const { dict } = useI18n();
  return useCallback((min: number) => {
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (h && m) return `${h}${dict.common.hoursShort} ${m}${dict.common.minutesShort}`;
    if (h)      return `${h}${dict.common.hoursShort}`;
    return `${m}${dict.common.minutesShort}`;
  }, [dict]);
}
