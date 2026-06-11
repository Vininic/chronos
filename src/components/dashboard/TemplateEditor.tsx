import { useState } from "react";
import type { TreeNode, LevelDef, WorkspaceStructure } from "@/lib/schedule/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Copy, Pencil } from "lucide-react";

function deepClone<T>(x: T): T {
  return structuredClone(x);
}

export function TemplateEditor({
  structure,
  onChange,
}: {
  structure: WorkspaceStructure;
  onChange: (structure: WorkspaceStructure) => void;
}) {
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemGroup, setNewItemGroup] = useState("");
  const [newItemFields, setNewItemFields] = useState<Record<string, string>>({});
  const [newSetCount, setNewSetCount] = useState("3");
  const [newGroupName, setNewGroupName] = useState("");

  const levels = structure.levels;
  const groupLabel = levels[0]?.label ?? "Group";
  const groupLabelPlural = levels[0]?.labelPlural ?? "Groups";
  const itemLabel = levels[1]?.label ?? "Item";
  const itemLabelPlural = levels[1]?.labelPlural ?? "Items";
  const itemNameLabel = `${itemLabel} Name`;
  const hasSets = levels.length > 2;

  function addTemplate(name?: string) {
    const n = name ?? prompt(`New program name:`);
    if (!n) return;
    const copy = deepClone(structure);
    copy.templates.push({ name: n, children: [] });
    onChange(copy);
  }

  function duplicateTemplate(idx: number) {
    const copy = deepClone(structure);
    const src = copy.templates[idx];
    copy.templates.splice(idx + 1, 0, { ...src, name: `${src.name} (copy)` });
    onChange(copy);
  }

  function removeTemplate(idx: number) {
    const copy = deepClone(structure);
    copy.templates.splice(idx, 1);
    if (editingTemplate === structure.templates[idx].name) setEditingTemplate(null);
    onChange(copy);
  }

  if (!editingTemplate) {
    const heading = levels[0]?.labelPlural ?? "Programs";
    return (
      <div className="space-y-3">
        <p className="text-sm font-medium text-secondary">{heading}</p>
        {structure.templates.length === 0 && (
          <p className="text-sm text-muted-foreground/60 py-4 text-center">
            No programs yet. Create your first one.
          </p>
        )}
        <div className="space-y-1">
          {structure.templates.map((tpl, i) => {
            const exerciseCount = tpl.children?.reduce((s, g) => s + (g.children?.length || 0), 0) ?? 0;
            const displayCount = exerciseCount > 0 ? `${exerciseCount} ${itemLabelPlural.toLowerCase()}` : "empty";
            return (
              <div
                key={i}
                className="flex items-center gap-2 rounded-lg border border-border/30 px-4 py-3 hover:bg-muted/20 group"
              >
                <span
                  className="flex-1 text-sm font-medium text-primary cursor-pointer min-w-0 truncate"
                  onClick={() => setEditingTemplate(tpl.name)}
                >
                  {tpl.name || "Untitled"}
                </span>
                <span className="text-xs text-muted-foreground/60 shrink-0">{displayCount}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); setEditingTemplate(tpl.name); }}
                  className="h-7 w-7 rounded grid place-items-center text-muted-foreground/40 hover:text-secondary/80 hover:bg-muted/40 opacity-0 group-hover:opacity-100 transition-opacity"
                  title={`Edit ${tpl.name}`}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); duplicateTemplate(i); }}
                  className="h-7 w-7 rounded grid place-items-center text-muted-foreground/40 hover:text-secondary/80 hover:bg-muted/40 opacity-0 group-hover:opacity-100 transition-opacity"
                  title={`Duplicate ${tpl.name}`}
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); removeTemplate(i); }}
                  className="h-7 w-7 rounded grid place-items-center opacity-0 group-hover:opacity-100 text-muted-foreground/40 hover:text-destructive/70 hover:bg-destructive/10 transition-opacity"
                  title={`Delete ${tpl.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => addTemplate()}
          className="h-8 text-xs gap-1 w-full"
        >
          <Plus className="h-3.5 w-3.5" /> New Program
        </Button>
      </div>
    );
  }

  const tplIdx = structure.templates.findIndex((t) => t.name === editingTemplate);
  if (tplIdx < 0) { setEditingTemplate(null); return null; }

  const template = structure.templates[tplIdx];
  const groups = template.children ?? [];
  const existingGroups = groups.map((g) => g.name);

  function addItem() {
    if (!newItemName.trim()) return;
    const copy = deepClone(structure);
    const tpl = copy.templates[tplIdx];
    const gName = newItemGroup.trim() || existingGroups[0] || groupLabel;
    let group = tpl.children?.find((g) => g.name === gName);
    if (!group) {
      const ng: TreeNode = { name: gName, children: [] };
      if (!tpl.children) tpl.children = [];
      tpl.children.push(ng);
      group = tpl.children[tpl.children.length - 1];
    }
    const setCount = parseInt(newSetCount) || 1;
    const fields: Record<string, unknown> = {};
    const lvlDef = levels[1];
    if (lvlDef) {
      for (const fd of lvlDef.fields) {
        const val = newItemFields[fd.name];
        if (val !== undefined && val !== "") {
          fields[fd.name] = fd.type === "number" ? Number(val) : val;
        }
      }
    }
    const setChildren: TreeNode[] = [];
    for (let i = 0; i < setCount; i++) {
      const sf: Record<string, unknown> = {};
      const tLvl = levels[2];
      if (tLvl && tLvl.fields.length > 0) {
        for (const fd of tLvl.fields) {
          const val = newItemFields[fd.name];
          if (val !== undefined && val !== "") {
            sf[fd.name] = fd.type === "number" ? Number(val) : val;
          }
        }
      }
      setChildren.push({ name: `Set ${i + 1}`, fields: Object.keys(sf).length > 0 ? sf : undefined });
    }
    if (!group.children) group.children = [];
    group.children.push({
      name: newItemName.trim(),
      children: setCount > 0 ? setChildren : undefined,
      fields: Object.keys(fields).length > 0 ? fields : undefined,
    });
    onChange(copy);
    setNewItemName("");
    setNewItemFields({});
    setNewSetCount("3");
    setShowAddForm(false);
  }

  function removeItem(groupIdx: number, itemIdx: number) {
    const copy = deepClone(structure);
    const g = copy.templates[tplIdx].children![groupIdx];
    g.children!.splice(itemIdx, 1);
    if (g.children!.length === 0) {
      copy.templates[tplIdx].children!.splice(groupIdx, 1);
    }
    onChange(copy);
  }

  function renameItem(groupIdx: number, itemIdx: number, name: string) {
    const copy = deepClone(structure);
    copy.templates[tplIdx].children![groupIdx].children![itemIdx].name = name;
    onChange(copy);
  }

  function updateItemField(groupIdx: number, itemIdx: number, fieldName: string, value: string) {
    const copy = deepClone(structure);
    const item = copy.templates[tplIdx].children![groupIdx].children![itemIdx];
    if (!item.fields) item.fields = {};
    const lvlDef = levels[1];
    const fd = lvlDef?.fields.find((f) => f.name === fieldName);
    const parsed: unknown = fd?.type === "number" ? (value ? Number(value) : "") : value;
    if (value === "" || value === undefined) {
      delete item.fields[fieldName];
    } else {
      item.fields[fieldName] = parsed;
    }
    onChange(copy);
  }

  function addNewGroup() {
    if (!newGroupName.trim()) return;
    const copy = deepClone(structure);
    if (!copy.templates[tplIdx].children) copy.templates[tplIdx].children = [];
    copy.templates[tplIdx].children!.push({ name: newGroupName.trim(), children: [] });
    onChange(copy);
    setNewGroupName("");
    setShowAddGroup(false);
  }

  function metadataString(item: TreeNode): string {
    const parts: string[] = [];
    if (item.children && item.children.length > 0) {
      const instr = item.children[0]?.fields?.instruction ?? item.children[0]?.fields?.[levels[2]?.fields[0]?.name ?? ""];
      parts.push(`${item.children.length}×${String(instr ?? "")}`);
    }
    for (const fd of levels[1]?.fields ?? []) {
      const val = item.fields?.[fd.name];
      if (val !== undefined && val !== "") {
        parts.push(String(val));
      }
    }
    return parts.filter(Boolean).join("·");
  }

  function formatExerciseRow(item: TreeNode): { label: string; meta: string } {
    const metaParts: string[] = [];
    if (item.children && item.children.length > 0) {
      const first = item.children[0];
      const instr = first.fields?.instruction ?? "";
      metaParts.push(`${item.children.length} sets`);
      if (instr) metaParts.push(String(instr));
      const extraFields = levels[2]?.fields.filter((f) => f.name !== "instruction") ?? [];
      for (const fd of extraFields) {
        const val = first.fields?.[fd.name];
        if (val !== undefined && val !== "") metaParts.push(String(val));
      }
    }
    for (const fd of levels[1]?.fields ?? []) {
      const val = item.fields?.[fd.name];
      if (val !== undefined && val !== "") metaParts.push(String(val));
    }
    return { label: item.name || "Unnamed", meta: metaParts.join(" · ") };
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 border-b border-border/20 pb-2">
        <button
          onClick={() => setEditingTemplate(null)}
          className="text-xs text-muted-foreground hover:text-primary transition-colors"
        >
          {levels[0]?.labelPlural ?? "Programs"}
        </button>
        <span className="text-xs text-muted-foreground/30">/</span>
        <span className="text-xs font-medium text-primary">{template.name}</span>
      </div>

      <div className="space-y-4">
        {groups.map((group, gi) => (
          <div key={gi}>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium px-1 py-0.5 border-b border-border/10 mb-1">
              {group.name.toUpperCase()}
            </div>
            <div className="space-y-0.5">
              {group.children?.map((item, ii) => {
                const { label, meta } = formatExerciseRow(item);
                return (
                  <div
                    key={ii}
                    className="flex items-center gap-2 rounded px-3 py-1.5 group hover:bg-muted/10 cursor-pointer text-sm"
                    onClick={() => {
                      const newName = prompt(`Rename "${item.name}":`, item.name);
                      if (newName && newName !== item.name) renameItem(gi, ii, newName);
                    }}
                  >
                    <span className="text-secondary font-medium min-w-0 flex-1 truncate">{label}</span>
                    {meta && <span className="text-xs text-muted-foreground/60 shrink-0">{meta}</span>}
                    <button
                      onClick={(e) => { e.stopPropagation(); removeItem(gi, ii); }}
                      className="h-6 w-6 rounded grid place-items-center opacity-0 group-hover:opacity-100 text-muted-foreground/30 hover:text-destructive/70 hover:bg-destructive/10 transition-opacity"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
            </div>
            <button
              onClick={() => { setNewItemGroup(group.name); setShowAddForm(true); }}
              className="flex items-center gap-1 text-xs text-muted-foreground/50 hover:text-secondary/80 px-3 py-1 mt-0.5 transition-colors"
            >
              <Plus className="h-3 w-3" /> Add {itemLabel.toLowerCase()}
            </button>
          </div>
        ))}
      </div>

      {showAddGroup && (
        <div className="flex items-center gap-2">
          <Input
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder={`New ${groupLabel.toLowerCase()} name`}
            className="h-7 text-xs flex-1"
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") addNewGroup(); if (e.key === "Escape") setShowAddGroup(false); }}
          />
          <Button size="sm" onClick={addNewGroup} className="h-7 text-xs" disabled={!newGroupName.trim()}>Add</Button>
          <button onClick={() => setShowAddGroup(false)} className="text-xs text-muted-foreground/60 hover:text-secondary">Cancel</button>
        </div>
      )}
      {!showAddGroup && (
        <button
          onClick={() => setShowAddGroup(true)}
          className="flex items-center gap-1 text-xs text-muted-foreground/50 hover:text-secondary/80 px-1 py-1 transition-colors"
        >
          <Plus className="h-3 w-3" /> Add {groupLabel.toLowerCase()}
        </button>
      )}

      {showAddForm && (
        <div className="rounded-lg border border-border/30 p-4 space-y-3 bg-muted/10 mt-2">
          <p className="text-xs font-medium text-secondary">New {itemLabel.toLowerCase()}</p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-2">
            <div className="col-span-2">
              <p className="text-[10px] text-muted-foreground mb-0.5">{itemNameLabel}</p>
              <Input
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder={`e.g. ${existingGroups[0] ? "Bench Press" : "New item"}`}
                className="h-7 text-xs"
                autoFocus
              />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground mb-0.5">{groupLabel}</p>
              <Input
                value={newItemGroup}
                onChange={(e) => setNewItemGroup(e.target.value)}
                placeholder={existingGroups[0] ?? `e.g. ${groupLabel}`}
                list="gl-suggestions"
                className="h-7 text-xs"
              />
              <datalist id="gl-suggestions">
                {existingGroups.map((g) => <option key={g} value={g} />)}
              </datalist>
            </div>
            {hasSets && (
              <>
                <div className="col-span-2 border-t border-border/10 pt-2 mt-1">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{levels[2]?.labelPlural ?? "Sets"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-0.5">Count</p>
                  <Input
                    type="number"
                    min={1}
                    value={newSetCount}
                    onChange={(e) => setNewSetCount(e.target.value)}
                    className="h-7 text-xs"
                  />
                </div>
                {levels[2]?.fields.map((fd) => (
                  <div key={fd.name}>
                    <p className="text-[10px] text-muted-foreground mb-0.5">{fd.label}</p>
                    <Input
                      type={fd.type === "number" ? "number" : "text"}
                      value={newItemFields[fd.name] ?? ""}
                      onChange={(e) => setNewItemFields({ ...newItemFields, [fd.name]: e.target.value })}
                      placeholder={fd.type === "number" ? "0" : fd.label}
                      className="h-7 text-xs"
                    />
                  </div>
                ))}
              </>
            )}
            {levels[1]?.fields.filter((fd) => fd.name !== "name").map((fd) => (
              <div key={fd.name}>
                <p className="text-[10px] text-muted-foreground mb-0.5">{fd.label}</p>
                <Input
                  type={fd.type === "number" ? "number" : "text"}
                  value={newItemFields[fd.name] ?? ""}
                  onChange={(e) => setNewItemFields({ ...newItemFields, [fd.name]: e.target.value })}
                  placeholder={fd.type === "number" ? "0" : fd.label}
                  className="h-7 text-xs"
                />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Button size="sm" onClick={addItem} className="h-7 text-xs" disabled={!newItemName.trim()}>
              Add {itemLabel.toLowerCase()}
            </Button>
            <button onClick={() => setShowAddForm(false)} className="text-xs text-muted-foreground/60 hover:text-secondary">
              Cancel
            </button>
          </div>
        </div>
      )}

      {groups.length === 0 && !showAddForm && (
        <div className="text-center py-6">
          <p className="text-sm text-muted-foreground/60">No {itemLabelPlural.toLowerCase()} yet.</p>
          <Button
            size="sm"
            onClick={() => setShowAddForm(true)}
            className="mt-2 h-8 text-xs gap-1"
          >
            <Plus className="h-3.5 w-3.5" /> Add your first {itemLabel.toLowerCase()}
          </Button>
        </div>
      )}
    </div>
  );
}
