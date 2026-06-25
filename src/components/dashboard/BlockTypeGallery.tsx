import { useState, useRef } from "react";
import type { ScheduleData } from "@/lib/schedule/types";
import { BUILTIN_KINDS } from "@/lib/schedule/types";
import { safeKindStyle, TAILWIND_TO_HEX, COLOR_PALETTE, COLOR_FAMILIES } from "./widgets";
import { useT } from "@/lib/i18n/I18nProvider";
import type { useScheduleText } from "@/lib/i18n/scheduleText";
import { TemplateEditor } from "./TemplateEditor";
import { WORKSPACE_PRESETS } from "@/workspaces/presets";
import { toast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Plus, GripVertical, Target, LayoutGrid, Pencil, Check, X, RotateCcw, Trash2, AlertTriangle, Wrench, Box, Dumbbell, BookOpen, GraduationCap, ClipboardList, Brain, ListChecks } from "lucide-react";

const PRESET_ICON: Record<string, typeof Dumbbell> = {
  "dumbbell": Dumbbell,
  "book-open": BookOpen,
  "graduation-cap": GraduationCap,
  "clipboard-list": ClipboardList,
  "brain": Brain,
  "list-checks": ListChecks,
};

interface BlockTypeGalleryProps {
  data: ScheduleData;
  t: ReturnType<typeof useT>;
  isPt: boolean;
  scheduleText: ReturnType<typeof useScheduleText>;
  onUpdate: (id: string, patch: Partial<ScheduleData["categories"][number]>) => void;
  onReset: (id: string) => void;
  onAdd: (cat: ScheduleData["categories"][number]) => void;
  onRemove: (id: string) => void;
  onReorder: (id: string, toIndex: number) => void;
  onSetFocus: (ids: string[]) => void;
}

export function BlockTypeGallery({
  data, t, isPt, scheduleText, onUpdate, onReset, onAdd, onRemove, onReorder, onSetFocus,
}: BlockTypeGalleryProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [configExtCategoryId, setConfigExtCategoryId] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState("");
  const [draftDesc, setDraftDesc] = useState("");
  const [draftColor, setDraftColor] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [createLabel, setCreateLabel] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [createColor, setCreateColor] = useState(COLOR_PALETTE[0]);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragIdRef = useRef<string | null>(null);

  function startEdit(c: ScheduleData["categories"][number]) {
    setEditingId(c.id);
    setDraftLabel(scheduleText.categoryLabel(c.id, c.label, c.labelCustom));
    setDraftDesc(scheduleText.categoryDescription(c.id, c.description, c.descriptionCustom));
    setDraftColor(c.color ?? TAILWIND_TO_HEX[safeKindStyle(c.id, data.categories).dot] ?? "#f59e0b");
  }

  function saveEdit(c: ScheduleData["categories"][number]) {
    const labelCustom = draftLabel !== scheduleText.categoryLabel(c.id, c.label, undefined) ? draftLabel : undefined;
    const descriptionCustom = draftDesc !== scheduleText.categoryDescription(c.id, c.description, undefined) ? draftDesc : undefined;
    onUpdate(c.id, { labelCustom, descriptionCustom, color: draftColor });
    setEditingId(null);
    toast({ title: t.chronos.settings.categoryUpdated });
  }

  function cancelEdit() { setEditingId(null); }

  function toggleFocus(id: string) {
    const current = data.meta.focusCategoryIds ?? [];
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    onSetFocus(next);
  }

  function handleCreate() {
    const id = createLabel.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    if (!id) { toast({ title: "Invalid name" }); return; }
    if (data.categories.find((c) => c.id === id)) { toast({ title: "Category already exists" }); return; }
    onAdd({ id, label: createLabel, description: createDesc, tone: "custom", color: createColor, workspace: undefined });
    setShowCreate(false);
    setCreateLabel("");
    setCreateDesc("");
    setCreateColor(COLOR_PALETTE[0]);
    toast({ title: t.chronos.settings.categorySaved(id) });
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    const kind = deleteTarget;
    const blockCount = data.routine.filter((r) => r.kind === kind).length + data.commitments.filter((c) => c.kind === kind).length;
    onRemove(kind);
    setDeleteTarget(null);
    toast({ title: `"${kind}" removed` + (blockCount > 0 ? ` · ${blockCount} blocks deleted` : "") });
  }

  function renderColorPicker(color: string, onChange: (c: string) => void) {
    const isCustomColor = color && !COLOR_FAMILIES.some((f) => f.shades.includes(color));
    return (
      <div className="rounded-lg border border-border/60 bg-card p-2 space-y-1.5">
        <div className="grid grid-cols-5 gap-0.5">
          {COLOR_FAMILIES.map((fam) => (
            fam.shades.map((s) => (
              <button key={s} type="button" onClick={() => onChange(color === s ? "" : s)}
                className={`h-5 w-full rounded-[2px] border transition-all ${color === s ? "ring-2 ring-offset-1 ring-secondary" : "border-border/40"}`}
                style={{ backgroundColor: s }}
                title={fam.family}
              />
            ))
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-muted-foreground">Custom:</span>
          <input type="color" value={color || "#f59e0b"} onChange={(e) => onChange(e.target.value)}
            className="h-5 w-8 rounded border border-border/60 cursor-pointer p-0.5" />
          {isCustomColor && (
            <span className="text-[9px] font-mono text-muted-foreground">{color}</span>
          )}
          {color && (
            <button type="button" onClick={() => onChange("")} className="text-muted-foreground hover:text-primary ml-auto">
              <X className="h-2.5 w-2.5" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <section>
      <div className="chronos-card p-4 space-y-2">
        <div className="space-y-px">
          {data.categories.map((c, idx) => {
            const blockStyle = safeKindStyle(c.id, data.categories);
            const dotKey = blockStyle.dot;
            const dotHex = blockStyle.customColor ?? TAILWIND_TO_HEX[dotKey] ?? "#f59e0b";
            const isEditing = editingId === c.id;
            const label = scheduleText.categoryLabel(c.id, c.label, c.labelCustom);
            const description = scheduleText.categoryDescription(c.id, c.description, c.descriptionCustom);
            const isBuiltin = (BUILTIN_KINDS as readonly string[]).includes(c.id);
            const hasCustom = !!(c.labelCustom || c.descriptionCustom || c.color);
            const isFocus = (data.meta.focusCategoryIds ?? []).includes(c.id);
            return (
              <div key={c.id} draggable={!isEditing}
                onDragStart={() => { dragIdRef.current = c.id; }}
                onDragOver={(e) => { e.preventDefault(); setDragOverIndex(idx); }}
                onDragEnd={() => { setDragOverIndex(null); dragIdRef.current = null; }}
                onDrop={() => {
                  if (dragIdRef.current && dragIdRef.current !== c.id) onReorder(dragIdRef.current, idx);
                  setDragOverIndex(null); dragIdRef.current = null;
                }}
                className={`${blockStyle.blockBg} ${blockStyle.blockBorder} rounded-lg px-4 py-3 transition-shadow ${
                  dragOverIndex === idx && dragIdRef.current && dragIdRef.current !== c.id ? 'ring-2 ring-secondary' : ''
                }`}
                style={blockStyle.blockStyle}
              >
                {isEditing ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: dotHex }} />
                      <input autoFocus value={draftLabel} onChange={(e) => setDraftLabel(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") saveEdit(c); if (e.key === "Escape") cancelEdit(); }}
                        className="flex-1 bg-card/80 text-sm font-medium text-primary rounded px-2 py-1 outline-none border border-border" />
                    </div>
                    <textarea value={draftDesc} onChange={(e) => setDraftDesc(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Escape") cancelEdit(); }} rows={2}
                      className="w-full bg-card/80 text-xs text-muted-foreground rounded px-2 py-1.5 outline-none border border-border resize-none" />
                    <div>{renderColorPicker(draftColor, setDraftColor)}</div>
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <div className="flex items-center gap-2">
                        <button onClick={() => saveEdit(c)}
                          className="h-7 px-3 rounded text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-1">
                          <Check className="h-3 w-3" /> {t.common.save}
                        </button>
                        <button onClick={cancelEdit}
                          className="h-7 px-3 rounded text-xs font-medium text-muted-foreground hover:bg-muted/60 transition-colors flex items-center gap-1">
                          <X className="h-3 w-3" /> {t.common.cancel}
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        {hasCustom && isBuiltin && (
                          <button onClick={() => { onReset(c.id); setEditingId(null); toast({ title: t.chronos.settings.categoryRestored }); }}
                            className="text-[10px] text-muted-foreground/40 hover:text-muted-foreground/60 flex items-center gap-1">
                            <RotateCcw className="h-3 w-3" /> {t.chronos.settings.restoreDefaultNames}
                          </button>
                        )}
                        <button onClick={() => { setDeleteTarget(c.id); cancelEdit(); }}
                          className="text-[10px] text-rose-500/50 hover:text-rose-500/80 flex items-center gap-1">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="cursor-grab active:cursor-grabbing text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors shrink-0">
                          <GripVertical className="h-3.5 w-3.5" />
                        </span>
                        <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: dotHex }} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium text-primary truncate">{label}</span>
                            {isFocus && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-secondary/15 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-secondary shrink-0">
                                <Target className="h-2.5 w-2.5" />
                                {isPt ? "Foco" : "Focus"}
                              </span>
                            )}
                          </div>
                          {description && <div className="text-xs text-muted-foreground truncate">{description}</div>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-[10px] text-muted-foreground/40 uppercase tracking-wide">{c.id}</div>
                        <button onClick={() => toggleFocus(c.id)}
                          className={`flex items-center gap-1 rounded px-1.5 py-1 text-[10px] font-medium leading-none transition-colors hover:bg-muted/40 ${
                            isFocus ? "text-secondary" : "text-muted-foreground/40 hover:text-secondary/70"
                          }`}
                          title={isFocus ? (isPt ? "Remover dos blocos de foco" : "Remove from focus blocks") : (isPt ? "Marcar como bloco de foco" : "Mark as focus block")}
                          aria-pressed={isFocus}>
                          <Target className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => setConfigExtCategoryId(c.id)}
                          className={`flex items-center gap-1 rounded px-1.5 py-1 text-[10px] font-medium leading-none transition-colors hover:bg-muted/40 ${
                            c.workspace ? "text-secondary" : "text-muted-foreground/40 hover:text-secondary/70"
                          }`}
                          title={c.workspace ? (isPt ? "Gerenciar programas" : "Manage programs") : (isPt ? "Adicionar programas" : "Add programs")}>
                          <LayoutGrid className={`h-3.5 w-3.5 ${c.workspace ? "drop-shadow-[0_0_3px_rgba(168,85,247,0.4)]" : ""}`} />
                        </button>
                        <button onClick={() => startEdit(c)}
                          className="text-[10px] text-muted-foreground/50 hover:text-secondary/80 transition-colors flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-muted/40">
                          <Pencil className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })}

          <button onClick={() => setShowCreate(true)}
            className="w-full border-2 border-dashed border-border/40 rounded-lg py-5 flex items-center justify-center gap-2 text-sm text-muted-foreground/50 hover:text-muted-foreground hover:border-muted-foreground/30 transition-colors">
            <Plus className="h-4 w-4" />
            {t.common.add}
          </button>
        </div>
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.chronos.settings.categories}</DialogTitle>
            <DialogDescription>{isPt ? "Criar novo tipo de bloco" : "Create a new block type"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.chronos.settings.categoryName}</Label>
              <input autoFocus value={createLabel} onChange={(e) => setCreateLabel(e.target.value)}
                placeholder={isPt ? "Ex: Leitura" : "e.g. Reading"}
                className="w-full bg-muted/60 text-sm text-primary rounded px-3 py-2 mt-1 outline-none border border-border" />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.chronos.settings.categoryDescription}</Label>
              <input value={createDesc} onChange={(e) => setCreateDesc(e.target.value)}
                placeholder={isPt ? "Descrição opcional" : "Optional description"}
                className="w-full bg-muted/60 text-sm text-primary rounded px-3 py-2 mt-1 outline-none border border-border" />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.chronos.settings.categoryTone}</Label>
              <div className="mt-2">{renderColorPicker(createColor, setCreateColor)}</div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: createColor }} />
                <span className="font-mono">{createColor}</span>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setShowCreate(false)}>{t.common.cancel}</Button>
                <Button size="sm" onClick={handleCreate}>{t.common.save}</Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-rose-500" /> {isPt ? "Remover categoria" : "Remove category"}</DialogTitle>
            <DialogDescription>
              {deleteTarget && (() => {
                const blockCount = data.routine.filter((r) => r.kind === deleteTarget).length + data.commitments.filter((c) => c.kind === deleteTarget).length;
                return isPt
                  ? `Isso removerá "${deleteTarget}" e ${blockCount} bloco(s) que usam esta categoria. Esta ação não pode ser desfeita.`
                  : `This will remove "${deleteTarget}" and ${blockCount} block(s) using this category. This action cannot be undone.`;
              })()}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setDeleteTarget(null)}>{t.common.cancel}</Button>
            <Button size="sm" variant="destructive" onClick={confirmDelete}>{isPt ? "Remover" : "Remove"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {configExtCategoryId && (() => {
        const cat = data.categories.find((c) => c.id === configExtCategoryId);
        if (!cat) return null;
        return (
          <Dialog open onOpenChange={(o) => { if (!o) setConfigExtCategoryId(null); }}>
            <DialogContent className="max-w-lg w-[calc(100vw-2rem)] max-h-[min(80vh,calc(100dvh-3rem))] overflow-x-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base">{cat.label ?? cat.id}</DialogTitle>
              </DialogHeader>
              {cat.workspace ? (
                <div className="space-y-4 py-2">
                  <TemplateEditor structure={cat.workspace} onChange={(ws) => { onUpdate(cat.id, { workspace: ws }); }} />
                  <div className="flex items-center justify-between gap-2 pt-2">
                    <Button variant="destructive" size="sm" onClick={() => { onUpdate(cat.id, { workspace: undefined }); setConfigExtCategoryId(null); }}>
                      {isPt ? "Remover" : "Remove"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 py-4">
                  <p className="text-sm text-muted-foreground">{isPt ? "Escolha um tipo:" : "Choose a type:"}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {WORKSPACE_PRESETS.map((p) => {
                      const Ic = PRESET_ICON[p.icon] ?? Box;
                      return (
                        <button key={p.id} onClick={() => { onUpdate(cat.id, { workspace: p.create() }); }}
                          className="flex items-start gap-2.5 rounded-lg border border-border/50 p-2.5 text-left hover:border-secondary/40 hover:bg-muted/20 transition-colors">
                          <Ic className="h-4 w-4 text-secondary shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-primary">{p.label}</div>
                            <div className="text-[10px] text-muted-foreground/60 leading-snug line-clamp-2">{p.description}</div>
                          </div>
                        </button>
                      );
                    })}
                    <button onClick={() => { onUpdate(cat.id, { workspace: { levels: [{ key: "item", label: "Item", labelPlural: "Items", fields: [], tracking: { type: "boolean", default: false, label: "Done" } }], display: { summary: "", nextStep: "", progress: "boolean" }, templates: [{ name: "Default", children: [] }] } }); }}
                      className="flex items-center justify-center gap-2.5 rounded-lg border border-dashed border-border/50 p-2.5 hover:border-secondary/40 hover:bg-muted/20 transition-colors col-span-2">
                      <Wrench className="h-4 w-4 text-secondary shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-primary">{isPt ? "Personalizado" : "Custom"}</div>
                        <div className="text-[10px] text-muted-foreground/60 leading-snug">{isPt ? "Crie seu próprio" : "Create your own"}</div>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        );
      })()}
    </section>
  );
}
