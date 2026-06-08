import type { CustomField, ScheduleData } from "@/lib/schedule/types";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table2 } from "lucide-react";

export function getCustomFields(data: ScheduleData, categoryId: string): CustomField[] | undefined {
  const cat = data.categories.find((c) => c.id === categoryId);
  return cat?.customFields;
}

export function getSchemaValues(extensions: Record<string, unknown> | undefined): Record<string, unknown> {
  const sn = extensions?.["structured-notes"] as { values?: Record<string, unknown> } | undefined;
  return sn?.values ?? {};
}

function renderFieldValue(field: CustomField, value: unknown) {
  if (value === undefined || value === null || value === "") return <span className="text-muted-foreground/40 italic">--</span>;
  switch (field.type) {
    case "boolean":
      return value ? "✓" : "✗";
    case "checklist":
      if (Array.isArray(value)) {
        const checked = value.filter(Boolean).length;
        return `${checked}/${value.length}`;
      }
      return String(value);
    default:
      return String(value);
  }
}

function renderFieldInput(
  field: CustomField,
  value: unknown,
  onChange: (value: unknown) => void,
) {
  switch (field.type) {
    case "text":
      return (
        <input
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-muted/60 text-xs text-primary rounded px-2 py-1 outline-none border border-border"
        />
      );
    case "number":
      return (
        <input
          type="number"
          value={value !== undefined && value !== null ? String(value) : ""}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
          className="w-full bg-muted/60 text-xs text-primary rounded px-2 py-1 outline-none border border-border"
        />
      );
    case "boolean":
      return (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
            className="rounded border-border/60"
          />
          <span className="text-xs text-muted-foreground">{value ? "Yes" : "No"}</span>
        </label>
      );
    case "select":
      return (
        <select
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value || undefined)}
          className="w-full bg-muted/60 text-xs text-primary rounded px-2 py-1 outline-none border border-border"
        >
          <option value="">--</option>
          {field.options?.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    case "checklist": {
      const checked = Array.isArray(value) ? value : [];
      return (
        <div className="space-y-1">
          {field.options?.map((opt, i) => (
            <label key={opt} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={!!checked[i]}
                onChange={(e) => {
                  const next = [...checked];
                  next[i] = e.target.checked;
                  onChange(next);
                }}
                className="rounded border-border/60"
              />
              <span className="text-xs text-muted-foreground">{opt}</span>
            </label>
          ))}
        </div>
      );
    }
    default:
      return null;
  }
}

export function SchemaBadge({
  fields,
  values,
}: {
  fields: CustomField[];
  values: Record<string, unknown>;
}) {
  const filled = fields.filter((f) => {
    const v = values[f.name];
    return v !== undefined && v !== null && v !== "";
  });
  if (filled.length === 0) return null;
  const preview = filled.slice(0, 3).map((f) => {
    const v = values[f.name];
    const label = f.label || f.name;
    if (f.type === "checklist" && Array.isArray(v)) {
      const checked = v.filter(Boolean).length;
      return `${label}: ${checked}/${v.length}`;
    }
    if (f.type === "boolean") return `${label}: ${v ? "✓" : "✗"}`;
    return `${label}: ${String(v)}`;
  });
  const label = preview.join(" | ");
  const remaining = filled.length - 3;
  return (
    <span className="inline-flex items-center gap-1 rounded bg-muted/40 px-1.5 py-0.5 text-[9px] text-muted-foreground leading-none max-w-[180px]" title={label + (remaining > 0 ? ` +${remaining} more` : "")}>
      <Table2 className="h-2.5 w-2.5 shrink-0" />
      <span className="truncate">{label}</span>
      {remaining > 0 && <span className="shrink-0 text-muted-foreground/50">+{remaining}</span>}
    </span>
  );
}

export function SchemaDetails({
  fields,
  values,
}: {
  fields: CustomField[];
  values: Record<string, unknown>;
}) {
  if (fields.length === 0) return null;
  return (
    <div className="space-y-1.5">
      {fields.map((field) => (
        <div key={field.name} className="flex items-center gap-3 min-w-0">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider shrink-0 min-w-[60px]">{field.label || field.name}</span>
          <span className="text-[11px] text-primary truncate">
            {field.type === "checklist" && Array.isArray(values[field.name])
              ? (values[field.name] as boolean[]).map((v, i) => (
                  <span key={i} className="inline-flex items-center gap-1 mr-2">
                    <span className={`h-1.5 w-1.5 rounded-full ${v ? "bg-green-500" : "bg-muted-foreground/30"}`} />
                    {field.options?.[i]}
                  </span>
                ))
              : renderFieldValue(field, values[field.name])}
          </span>
        </div>
      ))}
    </div>
  );
}

export function SchemaEditor({
  fields,
  values,
  onChange,
}: {
  fields: CustomField[];
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
}) {
  if (fields.length === 0) return null;

  function updateField(name: string, value: unknown) {
    onChange({ ...values, [name]: value });
  }

  return (
    <div className="space-y-2">
      {fields.map((field) => (
        <div key={field.name}>
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {field.label || field.name}
          </Label>
          <div className="mt-0.5">
            {renderFieldInput(field, values[field.name], (v) => updateField(field.name, v))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function SchemaSheetDialog({
  fields,
  values,
  title,
  schemaLabel,
  onClose,
}: {
  fields: CustomField[];
  values: Record<string, unknown>;
  title: string;
  schemaLabel: string;
  onClose: () => void;
}) {
  if (fields.length === 0) return null;
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Table2 className="h-4 w-4 text-secondary" />
            {title}
            <span className="text-xs text-muted-foreground font-normal">· {schemaLabel}</span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {fields.map((field) => {
            const val = values[field.name];
            return (
              <div key={field.name} className="border-b border-border/20 pb-2 last:border-0">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                  {field.label || field.name}
                  <span className="ml-1.5 text-[9px] text-muted-foreground/50">({field.type})</span>
                </div>
                <div className="text-sm text-primary">
                  {field.type === "checklist" && Array.isArray(val)
                    ? (val as boolean[]).map((v, i) => (
                        <div key={i} className="flex items-center gap-2 py-0.5">
                          <span className={`h-2 w-2 rounded-full ${v ? "bg-green-500" : "bg-muted-foreground/30"}`} />
                          <span className={v ? "text-primary" : "text-muted-foreground/50 line-through"}>
                            {field.options?.[i] ?? `Item ${i + 1}`}
                          </span>
                        </div>
                      ))
                    : val !== undefined && val !== null && val !== ""
                      ? String(val)
                      : <span className="text-muted-foreground/40 italic">--</span>}
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
