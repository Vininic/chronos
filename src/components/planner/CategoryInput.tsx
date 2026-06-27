import { useState, type KeyboardEvent } from "react";
import { X, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface CategoryInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  baseCategories?: string[];
}

export default function CategoryInput({
  value,
  onChange,
  placeholder = "Add category...",
  // "Sleep" is intentionally excluded — sleep is a structural part of the system
  // (the sleep window / boundary), never a user-created routine category.
  baseCategories = ["Deep Work", "Meeting", "Ritual", "Recovery", "Shallow", "Focus", "Study", "Exercise"],
}: CategoryInputProps) {
  const [inputValue, setInputValue] = useState("");

  const tags = value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  function addTag(label: string) {
    const trimmed = label.trim();
    if (!trimmed) return;
    if (tags.some((t) => t.toLowerCase() === trimmed.toLowerCase())) return;
    const next = [...tags, trimmed].join(", ");
    onChange(next);
    setInputValue("");
  }

  function removeTag(label: string) {
    const next = tags.filter((t) => t.toLowerCase() !== label.toLowerCase()).join(", ");
    onChange(next);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(inputValue);
    }
    if (e.key === "Backspace" && !inputValue && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <Badge
            key={tag}
            variant="secondary"
            className="flex items-center gap-1 px-2.5 py-1 text-sm font-normal"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="ml-0.5 rounded-full p-0.5 hover:bg-background/80 transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={tags.length === 0 ? placeholder : "Add more..."}
          className="flex-1 h-10 px-3 rounded-lg border border-border bg-background text-primary text-sm focus:outline-none focus:ring-2 focus:ring-secondary/40"
        />
        <button
          type="button"
          onClick={() => addTag(inputValue)}
          disabled={!inputValue.trim()}
          className="h-10 w-10 rounded-lg border border-border grid place-items-center text-muted-foreground hover:text-primary hover:border-secondary/40 transition-colors disabled:opacity-30"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {baseCategories.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <span className="text-[11px] text-muted-foreground mt-0.5">Base:</span>
          {baseCategories.map((cat) => {
            const exists = tags.some((t) => t.toLowerCase() === cat.toLowerCase());
            return (
              <button
                key={cat}
                type="button"
                disabled={exists}
                onClick={() => addTag(cat)}
                className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                  exists
                    ? "border-border/30 text-muted-foreground/40 cursor-default"
                    : "border-border text-muted-foreground hover:border-secondary/50 hover:text-primary"
                }`}
              >
                {cat}
                {!exists && <Plus className="h-2.5 w-2.5 inline ml-0.5 -mt-0.5" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
