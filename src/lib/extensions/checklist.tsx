import { CheckSquare, Square } from "lucide-react";
import { registerExtension } from "./registry";

let uidCounter = 0;
function cuid() {
  uidCounter += 1;
  return `cli-${uidCounter}-${Math.random().toString(36).slice(2, 6)}`;
}

export interface ChecklistData {
  items: { id: string; label: string; done: boolean }[];
}

function isChecklistData(v: unknown): v is ChecklistData {
  return typeof v === "object" && v !== null && "items" in v && Array.isArray((v as ChecklistData).items);
}

function addItem(data: unknown, label: string): ChecklistData {
  const d = isChecklistData(data) ? data : { items: [] };
  return { ...d, items: [...d.items, { id: cuid(), label, done: false }] };
}

function toggleItem(data: unknown, itemId: string): ChecklistData {
  if (!isChecklistData(data)) return { items: [] };
  return {
    ...data,
    items: data.items.map((item) => (item.id === itemId ? { ...item, done: !item.done } : item)),
  };
}

function removeItem(data: unknown, itemId: string): ChecklistData {
  if (!isChecklistData(data)) return { items: [] };
  return { ...data, items: data.items.filter((item) => item.id !== itemId) };
}

export function initChecklistExtension() {
  registerExtension({
    id: "checklist",
    label: "Checklist",
    icon: CheckSquare,
    schema: {
      items: { type: "string", label: "Checklist items" },
    },
    renderBadge(data) {
      if (!isChecklistData(data)) return null;
      const done = data.items.filter((i) => i.done).length;
      const total = data.items.length;
      if (total === 0) return null;
      return (
        <span className="flex items-center gap-0.5 text-[9px] tabular-nums text-muted-foreground/60">
          <CheckSquare className="h-2.5 w-2.5" />
          {done}/{total}
        </span>
      );
    },
    renderDetails(data) {
      if (!isChecklistData(data) || data.items.length === 0) return <div className="text-[10px] text-muted-foreground/40 italic">Empty</div>;
      return (
        <div className="space-y-0.5">
          {data.items.map((item) => (
            <div key={item.id} className="flex items-center gap-1.5 text-[11px]">
              {item.done ? (
                <CheckSquare className="h-3 w-3 text-secondary shrink-0" />
              ) : (
                <Square className="h-3 w-3 text-muted-foreground/40 shrink-0" />
              )}
              <span className={item.done ? "line-through text-muted-foreground/50" : ""}>{item.label}</span>
            </div>
          ))}
        </div>
      );
    },
    renderEditor(data, onChange) {
      return <ChecklistEditor data={data} onChange={onChange} />;
    },
  });
}

function ChecklistEditor({
  data,
  onChange,
}: {
  data: unknown;
  onChange: (next: unknown) => void;
}) {
  const items = isChecklistData(data) ? data.items : [];

  function handleToggle(id: string) {
    onChange(toggleItem(data, id));
  }

  function handleRemove(id: string) {
    onChange(removeItem(data, id));
  }

  function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const input = form.elements.namedItem("label") as HTMLInputElement;
    const label = input.value.trim();
    if (!label) return;
    onChange(addItem(data, label));
    input.value = "";
  }

  return (
    <div className="space-y-1.5">
      <form onSubmit={handleAdd} className="flex items-center gap-1.5">
        <input
          name="label"
          placeholder="Add item..."
          className="flex-1 h-7 rounded border border-border/60 bg-transparent px-2 text-[11px] outline-none focus:border-secondary/40"
        />
        <button
          type="submit"
          className="h-7 rounded bg-secondary/10 px-2 text-[10px] font-medium text-secondary hover:bg-secondary/20 transition-colors"
        >
          Add
        </button>
      </form>
      {items.length === 0 && (
        <p className="text-[10px] text-muted-foreground/40 italic">No items yet</p>
      )}
      <div className="space-y-0.5 max-h-[120px] overflow-y-auto">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-1.5 group">
            <button
              type="button"
              onClick={() => handleToggle(item.id)}
              className="shrink-0"
            >
              {item.done ? (
                <CheckSquare className="h-3 w-3 text-secondary" />
              ) : (
                <Square className="h-3 w-3 text-muted-foreground/40" />
              )}
            </button>
            <span className={`flex-1 text-[11px] truncate ${item.done ? "line-through text-muted-foreground/50" : ""}`}>
              {item.label}
            </span>
            <button
              type="button"
              onClick={() => handleRemove(item.id)}
              className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground/40 hover:text-destructive transition-all text-[10px]"
            >
              &times;
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
