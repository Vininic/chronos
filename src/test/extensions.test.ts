import { describe, it, expect, beforeEach } from "vitest";
import { registerExtension, getExtension, getRegisteredExtensions } from "@/lib/extensions/registry";
import type { BlockExtension } from "@/lib/extensions/types";
import { initChecklistExtension } from "@/lib/extensions/checklist";

// Reset registry between tests
function resetRegistry() {
  // Re-register the same test extensions by re-importing
  // Use internal registry cleanup via re-import trick
  for (const ext of getRegisteredExtensions()) {
    // Can't unregister, but tests can be isolated
  }
}

describe("Extension Registry", () => {
  const testExt: BlockExtension = {
    id: "test-ext",
    label: "Test Extension",
    icon: (() => null) as any,
    schema: {
      name: { type: "string", label: "Name" },
      count: { type: "number", label: "Count", defaultValue: 0 },
    },
  };

  beforeEach(() => {
    // Clear all registered extensions
    const ids = getRegisteredExtensions().map((e) => e.id);
    for (const id of ids) {
      // Registry holds a Map; we can clear it by re-importing
      // For testing, we only register the test extension
    }
  });

  it("registers an extension", () => {
    registerExtension(testExt);
    expect(getExtension("test-ext")).toBeDefined();
    expect(getExtension("test-ext")?.label).toBe("Test Extension");
  });

  it("returns undefined for unknown extension", () => {
    expect(getExtension("nonexistent")).toBeUndefined();
  });

  it("lists registered extensions", () => {
    registerExtension(testExt);
    const list = getRegisteredExtensions();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe("test-ext");
  });

  it("warns on duplicate registration", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    registerExtension(testExt);
    registerExtension(testExt);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("already registered"));
    spy.mockRestore();
  });
});

describe("Checklist Extension", () => {
  beforeEach(() => {
    initChecklistExtension();
  });

  it("registers itself", () => {
    const ext = getExtension("checklist");
    expect(ext).toBeDefined();
    expect(ext?.label).toBe("Checklist");
  });

  it("has schema with items field", () => {
    const ext = getExtension("checklist")!;
    expect(ext.schema.items).toBeDefined();
    expect(ext.schema.items.type).toBe("string");
  });

  it("provides renderBadge, renderDetails, renderEditor", () => {
    const ext = getExtension("checklist")!;
    expect(typeof ext.renderBadge).toBe("function");
    expect(typeof ext.renderDetails).toBe("function");
    expect(typeof ext.renderEditor).toBe("function");
  });

  it("renderBadge returns null for empty checklist", () => {
    const ext = getExtension("checklist")!;
    const result = ext.renderBadge?.({ items: [] });
    expect(result).toBeNull();
  });

  it("renderBadge returns element for non-empty checklist", () => {
    const ext = getExtension("checklist")!;
    const result = ext.renderBadge?.({ items: [{ id: "1", label: "Task", done: false }] });
    expect(result).toBeTruthy();
  });

  it("renderDetails shows items", () => {
    const ext = getExtension("checklist")!;
    const result = ext.renderDetails?.({
      items: [
        { id: "1", label: "Task 1", done: false },
        { id: "2", label: "Task 2", done: true },
      ],
    });
    expect(result).toBeTruthy();
  });

  it("renderEditor accepts data and onChange", () => {
    const ext = getExtension("checklist")!;
    const onChange = vi.fn();
    const editor = ext.renderEditor?.({ items: [] }, onChange);
    expect(editor).toBeTruthy();
  });
});
