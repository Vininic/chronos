import { Languages } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { LOCALE_LABELS, SUPPORTED_LOCALES } from "@/lib/i18n/dictionaries";

/**
 * Suite-wide language toggle.
 * `variant="dark"` for use over the midnight pane (e.g. Login left, Landing dark sections).
 */
export function LanguageToggle({ variant = "light" }: { variant?: "light" | "dark" }) {
  const { locale, setLocale, dict } = useI18n();
  const trigger =
    variant === "dark"
      ? "h-9 px-2.5 rounded-md border border-primary-foreground/20 bg-primary-foreground/5 text-primary-foreground/85 hover:bg-primary-foreground/10"
      : "h-9 px-2.5 rounded-md border border-border bg-background hover:bg-secondary/10 text-foreground";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button aria-label={dict.common.language} className={`inline-flex items-center gap-1.5 text-xs font-medium tracking-wider uppercase ${trigger}`}>
          <Languages className="h-3.5 w-3.5" /> {LOCALE_LABELS[locale].short}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {SUPPORTED_LOCALES.map((l) => (
          <DropdownMenuItem key={l} onClick={() => setLocale(l)} className={l === locale ? "text-secondary" : ""}>
            <span className="font-medium w-7">{LOCALE_LABELS[l].short}</span>
            <span className="text-muted-foreground">{LOCALE_LABELS[l].long}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
