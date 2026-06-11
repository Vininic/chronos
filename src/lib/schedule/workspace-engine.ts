import type { WorkspaceStructure, WorkspaceRuntime, TreeNode } from "@/lib/schedule/types";

type Path = string[];

function getLeafPaths(nodes: TreeNode[], depth: number, prefix: Path = []): Path[] {
  const result: Path[] = [];
  for (const node of nodes) {
    const path = [...prefix, node.name];
    if (depth <= 1) {
      result.push(path);
    } else if (node.children && node.children.length > 0) {
      result.push(...getLeafPaths(node.children, depth - 1, path));
    } else {
      result.push(path);
    }
  }
  return result;
}

function pathToKey(path: Path): string {
  return path.join("/");
}

export function selectTemplate(
  structure: WorkspaceStructure,
  templateName?: string,
): TreeNode | undefined {
  if (templateName) {
    return structure.templates.find((t) => t.name === templateName)
      ?? structure.templates[0];
  }
  return structure.templates[0];
}

export function initRuntime(
  structure: WorkspaceStructure,
  templateName?: string,
): WorkspaceRuntime {
  const tpl = selectTemplate(structure, templateName);
  if (!tpl) return {};

  const trackingLevel = structure.levels.find((l) => l.tracking);
  if (!trackingLevel) return { templateName: tpl.name };

  const depth = structure.levels.indexOf(trackingLevel) + 1;
  const paths = getLeafPaths(tpl.children ?? [], depth);
  const tracking: Record<string, boolean | number> = {};
  const def = trackingLevel.tracking!.default;
  for (const p of paths) {
    tracking[pathToKey(p)] = def as boolean | number;
  }
  return { templateName: tpl.name, tracking };
}

export function calcProgress(
  runtime: WorkspaceRuntime,
  structure: WorkspaceStructure,
): { done: number; total: number } {
  const r = runtime as Record<string, unknown>;

  const tracking = r.tracking as Record<string, unknown> | undefined;
  if (tracking) {
    const entries = Object.values(tracking);
    const total = entries.length;
    const trackingLevel = structure.levels.find((l) => l.tracking);
    if (trackingLevel?.tracking?.type === "number") {
      const target = trackingLevel.tracking.targetField;
      const done = entries.filter((v) => target !== undefined ? true : (v as number) > 0).length;
      return { done, total };
    }
    const done = entries.filter(Boolean).length;
    return { done, total };
  }

  const completedSets = r.completedSets as Record<string, number> | undefined;
  if (completedSets) {
    const entries = Object.keys(completedSets);
    const total = entries.length;
    const done = entries.filter((k) => (completedSets[k] ?? 0) > 0).length;
    return { done, total };
  }

  return { done: 0, total: 0 };
}

export function toggleTracking(
  runtime: WorkspaceRuntime,
  trackingKey: string,
): WorkspaceRuntime {
  const r = runtime as Record<string, unknown>;
  const tracking = { ...((r.tracking ?? {}) as Record<string, unknown>) } as Record<string, boolean | number>;
  tracking[trackingKey] = !tracking[trackingKey];
  return { ...r, tracking };
}

export function setTracking(
  runtime: WorkspaceRuntime,
  trackingKey: string,
  value: boolean | number,
): WorkspaceRuntime {
  const r = runtime as Record<string, unknown>;
  const tracking = { ...((r.tracking ?? {}) as Record<string, unknown>) } as Record<string, boolean | number>;
  tracking[trackingKey] = value;
  return { ...r, tracking };
}

export function getTrackingLeaves(
  structure: WorkspaceStructure,
  runtime: WorkspaceRuntime,
): { path: Path; key: string; label: string; value: unknown; parentPath: Path; parentLabel: string }[] {
  const r = runtime as Record<string, unknown>;
  const tracking = r.tracking as Record<string, unknown> | undefined;
  const completedSets = r.completedSets as Record<string, number> | undefined;

  if (completedSets && !tracking) {
    return Object.entries(completedSets).map(([name, val]) => ({
      path: [name],
      key: name,
      label: name,
      value: val > 0 ? true : false,
      parentPath: [],
      parentLabel: "",
    }));
  }

  const trackingLevel = structure.levels.find((l) => l.tracking);
  const tplName = r.templateName as string | undefined;
  const tpl = selectTemplate(structure, tplName);
  if (!trackingLevel || !tpl) return [];

  const depth = structure.levels.indexOf(trackingLevel) + 1;
  const paths = getLeafPaths(tpl.children ?? [], depth);
  const tr = tracking ?? {};

  return paths.map((p) => ({
    path: p,
    key: pathToKey(p),
    label: p[p.length - 1],
    value: tr[pathToKey(p)] ?? trackingLevel.tracking!.default,
    parentPath: p.slice(0, -1),
    parentLabel: p.length > 1 ? p[p.length - 2] : "",
  }));
}

export function resolveActiveTemplateName(runtime: WorkspaceRuntime): string {
  return ((runtime as Record<string, unknown>)?.templateName as string) ?? "";
}

export function getNextUndonePath(
  structure: WorkspaceStructure,
  runtime: WorkspaceRuntime,
): string[] | undefined {
  return getTrackingLeaves(structure, runtime).find(
    (l) => l.value === false || Number(l.value) === 0,
  )?.path;
}
