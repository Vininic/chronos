import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useI18n } from "@/lib/i18n/I18nProvider";

/** Suite-wide theme toggle. `variant="dark"` for midnight surfaces. */
export function ThemeToggle({ variant = "light" }: { variant?: "light" | "dark" }) {
  const { theme, toggleTheme } = useTheme();
  const { dict } = useI18n();
  const cls =
    variant === "dark"
      ? "h-9 w-9 rounded-md border border-primary-foreground/20 bg-primary-foreground/5 text-primary-foreground/85 hover:bg-primary-foreground/10"
      : "h-9 w-9 rounded-md border border-border bg-background hover:bg-secondary/10 text-foreground";
  const label = theme === "dark" ? dict.common.themeLight : dict.common.themeDark;
  return (
    <button onClick={toggleTheme} aria-label={label} title={label} className={`inline-grid place-items-center ${cls}`}>
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
