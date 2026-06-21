import { useState, useEffect, useCallback } from "react";

export interface ShortcutBinding {
  key: string;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
  alt: boolean;
}

export interface ShortcutDef {
  id: string;
  label: string;
  defaultBinding: ShortcutBinding;
}

const STORAGE_KEY = "chronos.keyboard.v1";

const DEFAULTS: ShortcutDef[] = [
  { id: "toggleSidebar", label: "Toggle sidebar", defaultBinding: { key: "\\", ctrl: false, meta: true, shift: false, alt: false } },
  { id: "navToday", label: "Go to Today", defaultBinding: { key: "1", ctrl: false, meta: true, shift: false, alt: false } },
  { id: "navWeek", label: "Go to Week", defaultBinding: { key: "2", ctrl: false, meta: true, shift: false, alt: false } },
  { id: "navFocus", label: "Go to Focus", defaultBinding: { key: "3", ctrl: false, meta: true, shift: false, alt: false } },
  { id: "navAetheris", label: "Go to Aetheris", defaultBinding: { key: "4", ctrl: false, meta: true, shift: false, alt: false } },
  { id: "navPlanner", label: "Go to Planner", defaultBinding: { key: "5", ctrl: false, meta: true, shift: false, alt: false } },
  { id: "focusChat", label: "Focus Aetheris chat input", defaultBinding: { key: "/", ctrl: false, meta: false, shift: false, alt: false } },
];

function loadCustom(): Record<string, ShortcutBinding> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); }
  catch { return {}; }
}

function saveCustom(map: Record<string, ShortcutBinding>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function getAllShortcuts(): ShortcutDef[] {
  return DEFAULTS;
}

export function getEffectiveBinding(def: ShortcutDef): ShortcutBinding {
  const custom = loadCustom();
  return custom[def.id] ?? def.defaultBinding;
}

export function setCustomBinding(id: string, binding: ShortcutBinding): void {
  const map = loadCustom();
  map[id] = binding;
  saveCustom(map);
}

export function resetBinding(id: string): void {
  const map = loadCustom();
  delete map[id];
  saveCustom(map);
}

export function resetAllBindings(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function bindingMatches(e: KeyboardEvent, b: ShortcutBinding): boolean {
  return e.key === b.key && e.ctrlKey === b.ctrl && e.metaKey === b.meta && e.shiftKey === b.shift && e.altKey === b.alt;
}

export function formatBinding(b: ShortcutBinding): string {
  const parts: string[] = [];
  if (b.ctrl) parts.push("Ctrl");
  if (b.meta) parts.push("Cmd");
  if (b.alt) parts.push("Alt");
  if (b.shift) parts.push("Shift");
  parts.push(b.key === "\\" ? "\\" : b.key.length === 1 ? b.key.toUpperCase() : b.key);
  return parts.join("+");
}

export function useBindings(): { bindings: Record<string, ShortcutBinding>; refresh: () => void } {
  const [v, setV] = useState(0);
  const refresh = useCallback(() => setV((n) => n + 1), []);
  const custom = loadCustom();
  const bindings: Record<string, ShortcutBinding> = {};
  for (const def of DEFAULTS) {
    bindings[def.id] = custom[def.id] ?? def.defaultBinding;
  }
  void v;
  return { bindings, refresh };
}

export function useRegisterShortcut(id: string, handler: () => void): void {
  useEffect(() => {
    const def = DEFAULTS.find((d) => d.id === id);
    if (!def) return;
    const cb = (e: KeyboardEvent) => {
      const b = getEffectiveBinding(def);
      if (bindingMatches(e, b)) {
        e.preventDefault();
        handler();
      }
    };
    window.addEventListener("keydown", cb);
    return () => window.removeEventListener("keydown", cb);
  }, [id, handler]);
}
