import { globalToolRegistry } from "./registry";
import type { Category } from "@/lib/schedule/types";

interface CreateProgramParams {
  categoryId: string;
  templateName: string;
}

interface UpdateProgramParams {
  categoryId: string;
  templateName: string;
  newTemplateName?: string;
}

interface DuplicateProgramParams {
  categoryId: string;
  templateName: string;
  newTemplateName: string;
}

export function registerProgramTools(
  mutators: {
    updateCategory: (id: string, patch: Partial<Pick<Category, "workspace">>) => void;
    removeCategory: (id: string) => void;
  },
): void {
  globalToolRegistry.register<CreateProgramParams, void>({
    name: "createProgram",
    description: "Create a new program template in a category",
    category: "program",
    permission: "write",
    validate: (p) => {
      if (!p.categoryId) return "categoryId is required";
      if (!p.templateName) return "templateName is required";
      return null;
    },
    execute: (p) => {
      mutators.updateCategory(p.categoryId, {
        workspace: { templates: [{ name: p.templateName, groups: [] }] },
      });
    },
  });

  globalToolRegistry.register<UpdateProgramParams, void>({
    name: "updateProgram",
    description: "Rename a program template",
    category: "program",
    permission: "write",
    validate: (p) => {
      if (!p.categoryId) return "categoryId is required";
      if (!p.templateName) return "templateName is required";
      return null;
    },
    execute: (p) => {
      mutators.updateCategory(p.categoryId, {
        workspace: { templates: [{ name: p.newTemplateName ?? p.templateName }] },
      });
    },
  });

  globalToolRegistry.register<DuplicateProgramParams, void>({
    name: "duplicateProgram",
    description: "Duplicate a program template under a new name",
    category: "program",
    permission: "write",
    validate: (p) => {
      if (!p.categoryId) return "categoryId is required";
      if (!p.templateName) return "templateName is required";
      if (!p.newTemplateName) return "newTemplateName is required";
      return null;
    },
    execute: (p) => {
      mutators.updateCategory(p.categoryId, {
        workspace: { templates: [{ name: p.newTemplateName }] },
      });
    },
  });

  globalToolRegistry.register<string, void>({
    name: "deleteProgram",
    description: "Delete a program (remove its category)",
    category: "program",
    permission: "write",
    validate: (id) => (id ? null : "categoryId is required"),
    execute: (id) => mutators.removeCategory(id),
  });
}
