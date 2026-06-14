import { globalToolRegistry } from "./registry";
import type { Category } from "@/lib/schedule/types";

interface CreateCategoryParams {
  id: string;
  label: string;
  description?: string;
  color?: string;
  tone?: string;
}

interface UpdateCategoryParams {
  categoryId: string;
  patch: Partial<Pick<Category, "label" | "labelCustom" | "description" | "color">>;
}

export function registerCategoryTools(
  mutators: {
    addCategory: (c: Omit<Category, never>) => void;
    updateCategory: (id: string, patch: Partial<Pick<Category, "label" | "labelCustom" | "description" | "descriptionCustom" | "tone" | "color" | "workspace">>) => void;
    removeCategory: (id: string) => void;
  },
): void {
  globalToolRegistry.register<CreateCategoryParams, void>({
    name: "createCategory",
    description: "Create a new activity category",
    category: "category",
    permission: "write",
    validate: (p) => {
      if (!p.id) return "id is required";
      if (!p.label) return "label is required";
      return null;
    },
    execute: (p) => mutators.addCategory({
      id: p.id,
      label: p.label,
      labelCustom: undefined,
      description: p.description ?? "",
      descriptionCustom: undefined,
      color: p.color ?? "#6366f1",
      tone: p.tone ?? "neutral",
      workspace: undefined,
    }),
  });

  globalToolRegistry.register<UpdateCategoryParams, void>({
    name: "updateCategory",
    description: "Update an existing category",
    category: "category",
    permission: "write",
    validate: (p) => (p.categoryId ? null : "categoryId is required"),
    execute: (p) => mutators.updateCategory(p.categoryId, p.patch),
  });

  globalToolRegistry.register<string, void>({
    name: "deleteCategory",
    description: "Delete a category by ID",
    category: "category",
    permission: "write",
    validate: (id) => (id ? null : "categoryId is required"),
    execute: (id) => mutators.removeCategory(id),
  });
}
