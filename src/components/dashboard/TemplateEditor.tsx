import { useState } from "react";
import type { TreeNode, WorkspaceStructure } from "@/lib/schedule/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Copy, Pencil } from "lucide-react";

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [newItemFields, setNewItemFields] = useState<Record<string, string>>({});
  const [newSetCount, setNewSetCount] = useState("3");
  const [newGroupName, setNewGroupName] = useState("");

  const [renamingItem, setRenamingItem] = useState<{ gi: number; ii: number } | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const [renamingGroup, setRenamingGroup] = useState<number | null>(null);
  const [renameGroupValue, setRenameGroupValue] = useState("");

  const [renamingTemplate, setRenamingTemplate] = useState<number | null>(null);
  const [renameTemplateValue, setRenameTemplateValue] = useState("");
  const [listTab, setListTab] = useState("programs");

  const [addFormGroup, setAddFormGroup] = useState<string | null>(null);
  const [newItemName, setNewItemName] = useState("");

  const levels = structure.levels;
  const groupLabel = levels[0]?.label ?? "Group";
  const groupLabelPlural = levels[0]?.labelPlural ?? "Groups";
  const itemLabel = levels[1]?.label ?? "Item";
  const itemLabelPlural = levels[1]?.labelPlural ?? "Items";
  const hasSets = levels.length > 2;

  function addTemplate(name?: string) {
    const n = name ?? `New ${groupLabel}`;
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
    return (
      <div className="space-y-3 min-w-0">
        <Tabs value={listTab} onValueChange={setListTab}>
          <TabsList>
            <TabsTrigger value="programs">{levels[0]?.labelPlural ?? "Programs"}</TabsTrigger>
            <TabsTrigger value="rotation">Rotation</TabsTrigger>
          </TabsList>
          <TabsContent value="programs" className="space-y-3 mt-3">
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
                    {renamingTemplate === i ? (
                      <input
                        autoFocus
                        value={renameTemplateValue}
                        onChange={(e) => setRenameTemplateValue(e.target.value)}
                        onBlur={() => {
                          if (renameTemplateValue.trim()) {
                            const copy = deepClone(structure);
                            copy.templates[i].name = renameTemplateValue.trim();
                            onChange(copy);
                          }
                          setRenamingTemplate(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            if (renameTemplateValue.trim()) {
                              const copy = deepClone(structure);
                              copy.templates[i].name = renameTemplateValue.trim();
                              onChange(copy);
                            }
                            setRenamingTemplate(null);
                          }
                          if (e.key === "Escape") setRenamingTemplate(null);
                        }}
                        className="flex-1 min-w-0 h-7 rounded border border-primary/30 bg-transparent px-2 text-sm outline-none"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span
                        className="flex-1 text-sm font-medium text-primary min-w-0 truncate cursor-text"
                        title="Click to rename"
                        onClick={() => { setRenamingTemplate(i); setRenameTemplateValue(tpl.name); }}
                      >
                        {tpl.name || "Untitled"}
                      </span>
                    )}
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
          </TabsContent>
          <TabsContent value="rotation" className="mt-3">
            {structure.templates.length === 0 ? (
              <p className="text-sm text-muted-foreground/60 py-4 text-center">
                Create programs first to set up rotation.
              </p>
            ) : (
              <div className="space-y-1">
                {DAY_SHORT.map((day, i) => {
                  const assigned = structure.rotation?.[String(i)];
                  return (
                    <div key={i} className="flex items-center gap-2 rounded-lg border border-border/30 px-3 py-2">
                      <span className="w-8 text-xs font-medium text-muted-foreground uppercase">{day}</span>
                      <div className="flex-1 flex flex-wrap gap-1">
                        {structure.templates.map((tpl) => (
                          <button
                            key={tpl.name}
                            type="button"
                            onClick={() => {
                              const copy = deepClone(structure);
                              if (!copy.rotation) copy.rotation = {};
                              if (copy.rotation[String(i)] === tpl.name) {
                                delete copy.rotation[String(i)];
                              } else {
                                copy.rotation[String(i)] = tpl.name;
                              }
                              onChange(copy);
                            }}
                            className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                              assigned === tpl.name
                                ? "border-primary bg-primary/10 text-primary font-medium"
                                : "border-border/50 text-muted-foreground/70 hover:border-secondary/40 hover:text-secondary"
                            }`}
                          >
                            {tpl.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  const tplIdx = structure.templates.findIndex((t) => t.name === editingTemplate);
  if (tplIdx < 0) { setEditingTemplate(null); return null; }

  const template = structure.templates[tplIdx];
  const groups = template.children ?? [];
  const existingGroups = groups.map((g) => g.name);

  function addItem() {
    if (!newItemName.trim() || !addFormGroup) return;
    const copy = deepClone(structure);
    const tpl = copy.templates[tplIdx];
    const gName = addFormGroup;
    const group = tpl.children?.find((g) => g.name === gName);
    if (!group) return;
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
    setAddFormGroup(null);
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

  function renameGroup(groupIdx: number, name: string) {
    const copy = deepClone(structure);
    copy.templates[tplIdx].children![groupIdx].name = name;
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
    <div className="space-y-4 min-w-0">
      <div className="flex items-center gap-2 border-b border-border/20 pb-2 overflow-x-hidden">
        <button
          onClick={() => setEditingTemplate(null)}
          className="text-xs text-muted-foreground hover:text-primary transition-colors shrink-0"
        >
          {levels[0]?.labelPlural ?? "Programs"}
        </button>
        <span className="text-xs text-muted-foreground/30 shrink-0">/</span>
        <span className="text-xs font-medium text-primary truncate min-w-0">{template.name}</span>
      </div>

      <div className="space-y-4 min-w-0">
        {groups.map((group, gi) => (
          <div key={gi}>
            {renamingGroup === gi ? (
              <input
                autoFocus
                value={renameGroupValue}
                onChange={(e) => setRenameGroupValue(e.target.value)}
                onBlur={() => {
                  if (renameGroupValue.trim() && renameGroupValue !== group.name) renameGroup(gi, renameGroupValue.trim());
                  setRenamingGroup(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    if (renameGroupValue.trim() && renameGroupValue !== group.name) renameGroup(gi, renameGroupValue.trim());
                    setRenamingGroup(null);
                  }
                  if (e.key === "Escape") setRenamingGroup(null);
                }}
                className="w-full h-6 rounded border border-primary/30 bg-transparent px-1.5 text-[10px] uppercase tracking-wider font-medium outline-none text-muted-foreground"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <div
                className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium px-1 py-0.5 border-b border-border/10 mb-1 cursor-text"
                title="Click to rename"
                onClick={() => { setRenamingGroup(gi); setRenameGroupValue(group.name); }}
              >
                {group.name.toUpperCase()}
              </div>
            )}
            <div className="space-y-0.5">
              {group.children?.map((item, ii) => {
                const { label, meta } = formatExerciseRow(item);
                return (
                  <div
                    key={ii}
                    className="flex items-center gap-2 rounded px-3 py-1.5 group hover:bg-muted/10 text-sm"
                  >
                    {renamingItem?.gi === gi && renamingItem?.ii === ii ? (
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={() => {
                          if (renameValue.trim() && renameValue !== item.name) renameItem(gi, ii, renameValue.trim());
                          setRenamingItem(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            if (renameValue.trim() && renameValue !== item.name) renameItem(gi, ii, renameValue.trim());
                            setRenamingItem(null);
                          }
                          if (e.key === "Escape") setRenamingItem(null);
                        }}
                        className="flex-1 min-w-0 h-6 rounded border border-primary/30 bg-transparent px-1.5 text-sm text-secondary outline-none"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span
                        className="text-secondary font-medium min-w-0 flex-1 truncate cursor-text"
                        title="Click to rename"
                        onClick={() => { setRenamingItem({ gi, ii }); setRenameValue(item.name); }}
                      >
                        {label}
                      </span>
                    )}
                    {meta && <span className="text-xs text-muted-foreground/60 min-w-0 truncate max-w-[120px]">{meta}</span>}
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
              onClick={() => { setAddFormGroup(group.name); setNewItemName(""); setNewItemFields({}); setNewSetCount("3"); }}
              className="flex items-center gap-1 text-xs text-muted-foreground/50 hover:text-secondary/80 px-3 py-1 mt-0.5 transition-colors"
            >
              <Plus className="h-3 w-3" /> Add {itemLabel.toLowerCase()}
            </button>
            {addFormGroup === group.name && (
              <div className="rounded-lg border border-border/30 p-3 space-y-2 bg-muted/10 mt-1">
                <input
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder={`e.g. Bench Press`}
                  className="w-full h-7 rounded border border-input bg-card text-xs px-2 outline-none focus:border-primary/50"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter" && newItemName.trim()) addItem(); if (e.key === "Escape") setAddFormGroup(null); }}
                />
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  {existingGroups.length > 1 && (
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="text-[9px] text-muted-foreground shrink-0">{groupLabel}:</span>
                      <select
                        value={addFormGroup}
                        onChange={(e) => setAddFormGroup(e.target.value)}
                        className="h-6 max-w-[100px] rounded border border-input bg-card text-[10px] px-1 outline-none truncate"
                      >
                        {existingGroups.map((g) => (
                          <option key={g} value={g}>{g}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {hasSets && (
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] text-muted-foreground shrink-0">Sets:</span>
                      <input
                        type="number"
                        min={1}
                        value={newSetCount}
                        onChange={(e) => setNewSetCount(e.target.value)}
                        className="w-10 h-6 rounded border border-input bg-card text-[10px] text-center px-1 outline-none"
                      />
                    </div>
                  )}
                  {levels[2]?.fields.map((fd) => (
                    <div key={fd.name} className="flex items-center gap-1 min-w-0">
                      <span className="text-[9px] text-muted-foreground shrink-0">{fd.label}:</span>
                      <input
                        type={fd.type === "number" ? "number" : "text"}
                        value={newItemFields[fd.name] ?? ""}
                        onChange={(e) => setNewItemFields({ ...newItemFields, [fd.name]: e.target.value })}
                        placeholder={fd.type === "number" ? "0" : "e.g. 8 reps"}
                        className="w-16 h-6 rounded border border-input bg-card text-[10px] px-1 outline-none"
                      />
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Button size="sm" onClick={addItem} className="h-7 text-xs" disabled={!newItemName.trim()}>
                    Add {itemLabel.toLowerCase()}
                  </Button>
                  <button onClick={() => setAddFormGroup(null)} className="text-xs text-muted-foreground/60 hover:text-primary">
                    Cancel
                  </button>
                </div>
              </div>
            )}
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

      {groups.length === 0 && !addFormGroup && (
        <div className="text-center py-6">
          <p className="text-sm text-muted-foreground/60">No {itemLabelPlural.toLowerCase()} yet.</p>
          <Button
            size="sm"
            onClick={() => {
              const gName = `New ${groupLabel}`;
              const copy = deepClone(structure);
              if (!copy.templates[tplIdx].children) copy.templates[tplIdx].children = [];
              copy.templates[tplIdx].children!.push({ name: gName, children: [] });
              onChange(copy);
              setAddFormGroup(gName);
              setNewItemName("");
              setNewItemFields({});
              setNewSetCount("3");
            }}
            className="mt-2 h-8 text-xs gap-1"
          >
            <Plus className="h-3.5 w-3.5" /> Add your first {itemLabel.toLowerCase()}
          </Button>
        </div>
      )}
    </div>
  );
}
