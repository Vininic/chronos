import type { BlockExtension } from "./types";

const registry = new Map<string, BlockExtension>();

export function registerExtension(ext: BlockExtension): void {
  if (registry.has(ext.id)) {
    console.warn(`Extension "${ext.id}" is already registered. Skipping.`);
    return;
  }
  registry.set(ext.id, ext);
}

export function getExtension(id: string): BlockExtension | undefined {
  return registry.get(id);
}

export function getRegisteredExtensions(): BlockExtension[] {
  return Array.from(registry.values());
}
