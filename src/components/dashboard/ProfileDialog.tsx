import { useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  LogOut, Upload, RotateCcw, FileJson, FileSpreadsheet, Calendar,
  ChevronDown, ChevronRight, Pencil, Check, X, BarChart3,
  Layers, FileUp, ChevronLeft, ArrowLeftRight,
} from "lucide-react";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel";
import { useAuth } from "@/lib/auth";
import { useSchedule, buildAgendaForDate } from "@/lib/schedule/store";
import { useT, useFmtDur, useI18n } from "@/lib/i18n/I18nProvider";
import { toast } from "@/hooks/use-toast";
import { exportToJSON, exportToXLSX, exportToICS } from "@/lib/schedule/export";
import { kindStyle } from "./widgets";
import type { BlockKind } from "@/lib/schedule/types";
import { durationMin } from "@/lib/schedule/types";
import type { ScheduleData } from "@/lib/schedule/types";

const DOT_HEX_BY_KIND: Record<string, string> = {
  "bg-amber-500": "#f59e0b",
  "bg-blue-500": "#3b82f6",
  "bg-violet-500": "#8b5cf6",
  "bg-emerald-500": "#10b981",
  "bg-slate-400": "#94a3b8",
  "bg-indigo-400": "#818cf8",
};

const ALL_KINDS: BlockKind[] = ["deep", "meeting", "ritual", "recovery", "shallow", "sleep"];


interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function getProfileData(sd: ScheduleData) {
  const today = new Date();
  const agenda = buildAgendaForDate(sd, today);
  const totalMin = agenda.reduce((sum, a) => sum + durationMin(a.start, a.end), 0);
  const blocks = agenda.filter((a) => a.kind !== "sleep");
  const topBlocks = blocks;
  const rCount = sd.routine.length;
  const cCount = sd.commitments.length;
  const score = sd.ledger.compositionScore;

  const kindCounts = new Map<BlockKind, number>();
  for (const k of ALL_KINDS) kindCounts.set(k, 0);
  for (const r of sd.routine) kindCounts.set(r.kind, (kindCounts.get(r.kind) ?? 0) + 1);
  for (const c of sd.commitments) kindCounts.set(c.kind, (kindCounts.get(c.kind) ?? 0) + 1);
  const topCategories = [...kindCounts.entries()].sort((a, b) => b[1] - a[1]);

  return { totalMin, blocks, topBlocks, rCount, cCount, score, topCategories };
}

function ProfileSlide({
  sd,
  label,
  isCurrent,
  onImport,
  onReset,
  onSignOut,
  onClone,
  onDelete,
  onActivate,
}: {
  sd: ScheduleData | null;
  label: string;
  isCurrent: boolean;
  onImport?: () => void;
  onReset?: () => void;
  onSignOut?: () => void;
  onClone?: () => void;
  onDelete?: () => void;
  onActivate?: () => void;
}) {
  const { locale } = useI18n();
  const t = useT();
  const fmtDur = useFmtDur();
  const [exportOpen, setExportOpen] = useState(false);
  const [dataOpen, setDataOpen] = useState(false);

  const p = sd ? getProfileData(sd) : null;

  if (!sd || !p) {
    return (
      <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/30 p-6 text-center">
        <div className="flex items-center justify-center gap-2 text-xs text-sidebar-foreground/70 mb-4">
          <FileUp className="h-4 w-4 text-secondary" />
          {label}
        </div>
        <div className="text-sm text-sidebar-foreground/50 mb-4">{locale === "pt" ? "Nenhum perfil carregado" : "No profile loaded"}</div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            size="sm" variant="outline"
            className="h-8 text-[11px] bg-sidebar/50"
            style={{ borderColor: "hsl(var(--sidebar-border))", color: "hsl(var(--sidebar-foreground)/0.8)" }}
            onClick={onImport}
          >
            <Upload className="h-3.5 w-3.5 mr-1.5" /> {t.chronos.settings.importJSON}
          </Button>
          {!isCurrent && onClone && (
            <Button
              size="sm" variant="outline"
              className="h-8 text-[11px] bg-sidebar/50"
              style={{ borderColor: "hsl(var(--sidebar-border))", color: "hsl(var(--sidebar-foreground)/0.8)" }}
              onClick={onClone}
            >
              <FileUp className="h-3.5 w-3.5 mr-1.5" /> {locale === "pt" ? "Clonar atual" : "Clone current"}
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/30 p-3">
        <div className="flex items-center gap-1.5 text-[10px] text-sidebar-foreground/60 mb-2 uppercase tracking-wider">
          <BarChart3 className="h-3 w-3 text-secondary" />
          {t.chronos.nav.today}
          <span className="ml-auto">{t.chronos.widgets.movements(p.blocks.length)} · {fmtDur(p.totalMin)}</span>
        </div>
        {p.blocks.length === 0 ? (
          <div className="flex gap-1.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded border border-dashed border-sidebar-border px-2 py-1.5 text-center min-w-[3rem] opacity-30">
                <div className="text-[8px] text-sidebar-foreground/30">—</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {p.topBlocks.map((b) => {
              const s = kindStyle[b.kind as BlockKind] ?? kindStyle.deep;
              const hex = DOT_HEX_BY_KIND[s.dot] ?? "#f59e0b";
              return (
                <div
                  key={b.id}
                  className="rounded px-2.5 py-1 flex items-center gap-1.5"
                  style={{ backgroundColor: `${hex}16`, border: `1px solid ${hex}33` }}
                >
                  <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: hex }} />
                  <span className="text-[9px] text-sidebar-accent-foreground font-medium truncate max-w-[4rem]">{b.title}</span>
                  <span className="text-[8px] text-sidebar-foreground/50 num">{b.start.slice(0, 5)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/30 p-3">
        <div className="flex items-center gap-1.5 text-[10px] text-sidebar-foreground/60 mb-2 uppercase tracking-wider">
          <Layers className="h-3 w-3 text-secondary" />
          {t.chronos.settings.categories}
          <span className="ml-auto">{t.chronos.widgets.movements(p.rCount + p.cCount)}</span>
        </div>
        {p.topCategories.length === 0 ? (
          <div className="flex gap-1.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded border border-dashed border-sidebar-border px-2 py-2 min-w-[2.5rem] opacity-30" />
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {p.topCategories.map(([kind, count]) => {
              const s = kindStyle[kind];
              const hex = DOT_HEX_BY_KIND[s.dot] ?? "#f59e0b";
              return (
                <div
                  key={kind}
                  className="rounded px-2.5 py-1 flex items-center gap-1.5"
                  style={{ backgroundColor: `${hex}16`, border: `1px solid ${hex}33` }}
                >
                  <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: hex }} />
                  <span className="text-[9px] uppercase tracking-wider text-sidebar-foreground/50">{kind}</span>
                  <span className="text-[8px] text-sidebar-foreground/40 num">{count}x</span>
                </div>
              );
            })}

          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-sidebar-accent/30 border border-sidebar-border p-3 text-center">
          <div className="text-[9px] text-sidebar-foreground/50 uppercase tracking-wider">{t.chronos.widgets.composed}</div>
          <div className="text-base font-display text-sidebar-accent-foreground num mt-0.5">{fmtDur(p.totalMin)}</div>
        </div>
        <div className="rounded-lg bg-sidebar-accent/30 border border-sidebar-border p-3 text-center">
          <div className="text-[9px] text-sidebar-foreground/50 uppercase tracking-wider">{t.chronos.nav.composition}</div>
          <div className="text-base font-display text-sidebar-accent-foreground num mt-0.5">{p.rCount}</div>
        </div>
        <div className="rounded-lg bg-sidebar-accent/30 border border-sidebar-border p-3 text-center">
          <div className="text-[9px] text-sidebar-foreground/50 uppercase tracking-wider">{t.chronos.widgets.compositionScore}</div>
          <div className="text-base font-display text-sidebar-accent-foreground num mt-0.5">{Math.round(p.score)}%</div>
        </div>
      </div>

      <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/30 p-3 space-y-2 pb-4">
        <div>
          <button
            onClick={() => setExportOpen(!exportOpen)}
            className="flex items-center gap-2 w-full text-left text-xs text-sidebar-foreground/80 hover:text-sidebar-accent-foreground transition-colors py-1"
          >
            {exportOpen ? <ChevronDown className="h-3.5 w-3.5 text-secondary" /> : <ChevronRight className="h-3.5 w-3.5 text-secondary" />}
            <Upload className="h-3 w-3 text-secondary" />
            <span>{t.chronos.settings.export}</span>
          </button>
          {exportOpen && (
            <div className="flex flex-wrap gap-1.5 pt-1.5 pb-0.5">
              <Button size="sm" variant="outline" className="h-7 text-[10px] flex-1 min-w-[72px] bg-sidebar/50" style={{ borderColor: "hsl(var(--sidebar-border))", color: "hsl(var(--sidebar-foreground)/0.8)" }} onClick={() => { exportToJSON(sd); toast({ title: t.chronos.settings.jsonExported }); }}>
                <FileJson className="h-3 w-3 mr-1 text-amber-400" /> JSON
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-[10px] flex-1 min-w-[72px] bg-sidebar/50" style={{ borderColor: "hsl(var(--sidebar-border))", color: "hsl(var(--sidebar-foreground)/0.8)" }} onClick={() => { exportToXLSX(sd, undefined, locale); toast({ title: t.chronos.settings.xlsxExported }); }}>
                <FileSpreadsheet className="h-3 w-3 mr-1 text-emerald-400" /> XLSX
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-[10px] flex-1 min-w-[72px] bg-sidebar/50" style={{ borderColor: "hsl(var(--sidebar-border))", color: "hsl(var(--sidebar-foreground)/0.8)" }} onClick={() => { exportToICS(sd); toast({ title: t.chronos.settings.icsExported }); }}>
                <Calendar className="h-3 w-3 mr-1 text-violet-400" /> ICS
              </Button>
            </div>
          )}
        </div>

        {!isCurrent && (
          <>
            <div className="border-t border-sidebar-border" />
            <div className="flex flex-wrap gap-2 pt-1">
              <Button size="sm" variant="outline" className="h-7 text-[10px] flex-1 bg-sidebar/50" style={{ borderColor: "hsl(var(--sidebar-border))", color: "hsl(var(--sidebar-foreground)/0.8)" }} onClick={onActivate}>
                <ArrowLeftRight className="h-3 w-3 mr-1" /> {locale === "pt" ? "Tornar atual" : "Make current"}
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-[10px] flex-1 bg-sidebar/50" style={{ borderColor: "hsl(var(--sidebar-border))", color: "hsl(var(--sidebar-foreground)/0.8)" }} onClick={onClone}>
                <FileUp className="h-3 w-3 mr-1" /> {locale === "pt" ? "Clonar" : "Clone"}
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-[10px] flex-1 bg-sidebar/50" style={{ borderColor: "rgba(239,68,68,0.35)", color: "rgba(248,113,113,0.9)" }} onClick={onDelete}>
                <X className="h-3 w-3 mr-1" /> {locale === "pt" ? "Remover" : "Remove"}
              </Button>
            </div>
          </>
        )}

        {isCurrent && (
          <>
            <div className="border-t border-sidebar-border" />
            <div>
              <button
                onClick={() => setDataOpen(!dataOpen)}
                className="flex items-center gap-2 w-full text-left text-xs text-sidebar-foreground/80 hover:text-sidebar-accent-foreground transition-colors py-1"
              >
                {dataOpen ? <ChevronDown className="h-3.5 w-3.5 text-secondary" /> : <ChevronRight className="h-3.5 w-3.5 text-secondary" />}
                <RotateCcw className="h-3 w-3 text-secondary" />
                <span>{t.chronos.settings.scheduleData}</span>
              </button>
              {dataOpen && (
                <div className="flex flex-wrap gap-1.5 pt-1.5 pb-0.5">
                  <Button size="sm" variant="outline" className="h-7 text-[10px] flex-1 bg-sidebar/50" style={{ borderColor: "hsl(var(--sidebar-border))", color: "hsl(var(--sidebar-foreground)/0.8)" }} onClick={onImport}>
                    <Upload className="h-3 w-3 mr-1.5" /> {t.chronos.settings.importJSON}
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-[10px] flex-1 bg-sidebar/50" style={{ borderColor: "hsl(var(--sidebar-border))", color: "hsl(var(--sidebar-foreground)/0.8)" }} onClick={onReset}>
                    <RotateCcw className="h-3 w-3 mr-1.5" /> {t.chronos.settings.reset}
                  </Button>
                </div>
              )}
            </div>

            <div className="border-t border-sidebar-border" />
            <Button variant="outline" className="w-full h-8 text-xs bg-sidebar/50" style={{ borderColor: "rgba(239,68,68,0.4)", color: "rgba(248,113,113,1)" }} onClick={onSignOut}>
              <LogOut className="h-3.5 w-3.5 mr-1.5" /> {t.common.signOut}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export default function ProfileDialog({ open, onOpenChange }: Props) {
  const { data, replace, resetToSeed } = useSchedule();
  const { session, signOut, updateName } = useAuth();
  const { locale } = useI18n();
  const t = useT();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [slideIdx, setSlideIdx] = useState(0);
  const carouselApiRef = useRef<CarouselApi>(null);
  const [extraProfiles, setExtraProfiles] = useState<(ScheduleData | null)[]>([null]);
  const [pendingImportIdx, setPendingImportIdx] = useState<number | null>(null);

  const totalSlides = 1 + extraProfiles.length;

  const triggerImport = useCallback((idx: number) => {
    setPendingImportIdx(idx);
    setTimeout(() => fileRef.current?.click(), 0);
  }, []);

  function importJSON(file: File) {
    file.text().then((txt) => {
      try {
        const next = JSON.parse(txt);
        if (!next.routine || !Array.isArray(next.routine)) throw new Error("Invalid file");
        const idx = pendingImportIdx;
        setPendingImportIdx(null);
        if (idx === null) { toast({ title: t.chronos.settings.importFail, description: "No target" }); return; }
        if (idx === 0) {
          replace(next);
          toast({ title: t.chronos.settings.imported });
          onOpenChange(false);
        } else {
          setExtraProfiles((prev) => {
            const arr = [...prev];
            const slot = idx - 1;
            arr[slot] = next;
            if (slot === arr.length - 1) arr.push(null);
            return arr;
          });
          toast({ title: t.chronos.settings.imported });
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        toast({ title: t.chronos.settings.importFail, description: msg });
      }
    });
  }

  function cloneToSlot(slot: number) {
    setExtraProfiles((prev) => {
      const arr = [...prev];
      arr[slot] = structuredClone(data);
      if (slot === arr.length - 1) arr.push(null);
      return arr;
    });
    toast({ title: locale === "pt" ? "Perfil clonado" : "Profile cloned" });
  }

  function removeSlot(slot: number) {
    setExtraProfiles((prev) => {
      const arr = [...prev];
      arr.splice(slot, 1);
      if (arr.length === 0) arr.push(null);
      return arr;
    });
    toast({ title: locale === "pt" ? "Perfil removido" : "Profile removed" });
  }

  function activateSlot(slot: number) {
    const profile = extraProfiles[slot];
    if (!profile) return;
    setExtraProfiles((prev) => {
      const arr = [...prev];
      arr[slot] = structuredClone(data);
      return arr;
    });
    replace(profile);
    toast({ title: locale === "pt" ? "Perfil ativado" : "Profile activated" });
  }

  function startEditing() {
    setNameDraft(session?.name ?? data.meta.owner);
    setEditing(true);
  }
  function saveName() {
    const trimmed = nameDraft.trim();
    if (trimmed) updateName(trimmed);
    setEditing(false);
  }
  function cancelEditing() { setEditing(false); }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-xl max-h-[90vh] overflow-y-auto p-0 gap-0 bg-sidebar text-sidebar-foreground border-sidebar-border"
      >
        <div className="p-4 pb-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-bronze grid place-items-center text-primary-deep font-display text-base font-semibold shrink-0">
              {(session?.name ?? "A").trim().charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              {editing ? (
                <div className="flex items-center gap-1.5">
                  <input
                    autoFocus
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") cancelEditing(); }}
                    className="bg-sidebar-accent/60 text-sidebar-accent-foreground text-sm font-display rounded px-2 py-0.5 w-32 outline-none border border-sidebar-border"
                  />
                  <button onClick={saveName} className="text-secondary hover:text-secondary/80 p-0.5"><Check className="h-3 w-3" /></button>
                  <button onClick={cancelEditing} className="text-sidebar-foreground/50 hover:text-sidebar-foreground/80 p-0.5"><X className="h-3 w-3" /></button>
                </div>
              ) : (
                <div className="flex items-center gap-2 group">
                  <span className="text-sm font-display text-sidebar-accent-foreground">{session?.name ?? data.meta.owner}</span>
                  <button onClick={startEditing} className="opacity-0 group-hover:opacity-100 text-sidebar-foreground/40 hover:text-secondary/80 transition-all p-0.5">
                    <Pencil className="h-2.5 w-2.5" />
                  </button>
                </div>
              )}
              <div className="text-[10px] text-sidebar-foreground/50">{t.common.appName}</div>
            </div>
          </div>
        </div>

        <div className="px-4 pb-4">
          <Carousel
            opts={{
              align: "start", loop: false,
              watchDrag: (emblaApi, evt) => {
                const t = evt.event.target as HTMLElement | null;
                if (t?.closest("span,p,h1,h2,h3,h4,h5,h6,label,li,button,input,select,textarea,a")) return false;
                const sel = window.getSelection();
                if (sel && !sel.isCollapsed) return false;
                return true;
              },
            }}
            className="w-full"
            draggable={false}
            onDragStart={(e) => e.preventDefault()}
            setApi={(api: CarouselApi) => {
              carouselApiRef.current = api;
              setSlideIdx(api.selectedScrollSnap());
              api.on("select", () => setSlideIdx(api.selectedScrollSnap()));
            }}
          >
            <CarouselContent className="-ml-3 select-none" onDragStart={(e) => e.preventDefault()}>
              {/* Slide 0: Current profile */}
              <CarouselItem className="pl-3 basis-full select-text" draggable={false}>
                <div>
                  <div className="flex items-center gap-1.5 mb-3 text-[10px] text-sidebar-foreground/50 uppercase tracking-wider">
                    <span className="h-1.5 w-1.5 rounded-full bg-secondary" />
                    {locale === "pt" ? "Perfil atual" : "Current profile"}
                  </div>
                  <ProfileSlide
                    sd={data}
                    label={locale === "pt" ? "Perfil atual" : "Current profile"}
                    isCurrent
                    onImport={() => triggerImport(0)}
                    onReset={() => { resetToSeed(); toast({ title: t.chronos.settings.resetDone }); }}
                    onSignOut={() => { signOut(); navigate("/login"); onOpenChange(false); }}
                  />
                </div>
              </CarouselItem>

              {/* Slides 1..N: extra profiles */}
              {extraProfiles.map((ep, i) => (
                <CarouselItem key={i} className="pl-3 basis-full">
                  <div>
                    <div className="flex items-center gap-1.5 mb-3 text-[10px] text-sidebar-foreground/50 uppercase tracking-wider">
                      <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
                      {locale === "pt" ? `Perfil ${i + 2}` : `Profile ${i + 2}`}
                    </div>
                    <ProfileSlide
                      sd={ep}
                      label={locale === "pt" ? `Perfil ${i + 2}` : `Profile ${i + 2}`}
                      isCurrent={false}
                      onImport={() => triggerImport(i + 1)}
                      onClone={() => cloneToSlot(i)}
                      onDelete={() => removeSlot(i)}
                      onActivate={() => activateSlot(i)}
                    />
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>

            <div className="flex items-center justify-between mt-4">
              <button
                onClick={() => carouselApiRef.current?.scrollPrev()}
                disabled={slideIdx === 0}
                className="h-7 w-7 rounded-full grid place-items-center transition-colors disabled:opacity-30"
                style={{
                  backgroundColor: slideIdx > 0 ? "hsl(var(--secondary))" : "transparent",
                  color: slideIdx > 0 ? "hsl(var(--primary-deep))" : "hsl(var(--sidebar-foreground)/0.3)",
                  border: slideIdx === 0 ? "1px solid hsl(var(--sidebar-border))" : "none",
                }}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>

              <div className="flex items-center gap-2">
                {Array.from({ length: totalSlides }).map((_, j) => (
                  <span
                    key={j}
                    className={`h-1.5 w-1.5 rounded-full transition-colors ${
                      slideIdx === j ? (j === 0 ? "bg-secondary" : "bg-violet-500") : "bg-sidebar-border"
                    }`}
                  />
                ))}
                <span className="text-[9px] text-sidebar-foreground/40 ml-1 select-none">{slideIdx + 1}/{totalSlides}</span>
              </div>

              <button
                onClick={() => carouselApiRef.current?.scrollNext()}
                disabled={slideIdx === totalSlides - 1}
                className="h-7 w-7 rounded-full grid place-items-center transition-colors disabled:opacity-30"
                style={{
                  backgroundColor: slideIdx < totalSlides - 1 ? "hsl(var(--secondary))" : "transparent",
                  color: slideIdx < totalSlides - 1 ? "hsl(var(--primary-deep))" : "hsl(var(--sidebar-foreground)/0.3)",
                  border: slideIdx === totalSlides - 1 ? "1px solid hsl(var(--sidebar-border))" : "none",
                }}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </Carousel>
        </div>

        <input
          ref={fileRef}
          type="file" accept="application/json" hidden
          onChange={(e) => { const f = e.target.files?.[0]; if (f) { importJSON(f); } e.currentTarget.value = ""; }}
        />
      </DialogContent>
    </Dialog>
  );
}
