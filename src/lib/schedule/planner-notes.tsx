export type NoteTone = "amber" | "sky" | "emerald" | "rose" | "violet";

export type NoteLine = {
  text: string;
  tone: NoteTone;
};

export const noteToneStyles: Record<NoteTone, { bg: string; border: string; text: string; chip: string; solid: string }> = {
  amber: {
    bg: "bg-amber-500/12",
    border: "border-amber-500/25",
    text: "text-amber-900 dark:text-amber-100",
    chip: "bg-amber-500/20 text-amber-700 dark:text-amber-200",
    solid: "bg-amber-500",
  },
  sky: {
    bg: "bg-sky-500/12",
    border: "border-sky-500/25",
    text: "text-sky-900 dark:text-sky-100",
    chip: "bg-sky-500/20 text-sky-700 dark:text-sky-200",
    solid: "bg-sky-500",
  },
  emerald: {
    bg: "bg-emerald-500/12",
    border: "border-emerald-500/25",
    text: "text-emerald-900 dark:text-emerald-100",
    chip: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-200",
    solid: "bg-emerald-500",
  },
  rose: {
    bg: "bg-rose-500/12",
    border: "border-rose-500/25",
    text: "text-rose-900 dark:text-rose-100",
    chip: "bg-rose-500/20 text-rose-700 dark:text-rose-200",
    solid: "bg-rose-500",
  },
  violet: {
    bg: "bg-violet-500/12",
    border: "border-violet-500/25",
    text: "text-violet-900 dark:text-violet-100",
    chip: "bg-violet-500/20 text-violet-700 dark:text-violet-200",
    solid: "bg-violet-500",
  },
};

export function parseNoteLine(raw: string): NoteLine {
  const trimmed = raw.trim();
  const explicit = trimmed.match(/^(amber|yellow|sky|blue|emerald|green|rose|red|violet|purple)\s*:\s*(.+)$/i);
  if (explicit) {
    const token = explicit[1].toLowerCase();
    const text = explicit[2].trim();
    const tone: NoteTone =
      token === "yellow" ? "amber"
      : token === "blue" ? "sky"
      : token === "green" ? "emerald"
      : token === "red" ? "rose"
      : token === "purple" ? "violet"
      : (token as NoteTone);
    return { text, tone };
  }
  return { text: trimmed, tone: "amber" };
}

export function parseNotes(notes?: string): NoteLine[] {
  return (notes ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => parseNoteLine(line));
}

export function serializeNotes(lines: NoteLine[]) {
  return lines
    .map((line) => ({
      text: line.text.trim(),
      tone: line.tone,
    }))
    .filter((line) => line.text.length > 0)
    .map((line) => (line.tone === "amber" ? line.text : `${line.tone}: ${line.text}`))
    .join("\n");
}

export function renderLinkedText(text: string) {
  const parts = text.split(/(https?:\/\/[^\s]+)/gi);
  return parts.map((part, index) => {
    if (/^https?:\/\//i.test(part)) {
      return (
        <a
          key={`${part}-${index}`}
          href={part}
          target="_blank"
          rel="noreferrer"
          data-no-open="true"
          onClick={(e) => e.stopPropagation()}
          className="underline underline-offset-2 hover:text-primary"
        >
          {part}
        </a>
      );
    }
    return <span key={`${part}-${index}`}>{part}</span>;
  });
}
