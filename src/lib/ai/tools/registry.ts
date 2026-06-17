export type ToolPermission = "read" | "write" | "admin";
export type ToolCategory = "read" | "block" | "note" | "commitment" | "goal" | "category" | "program" | "session" | "optimization";

export interface ToolDefinition<TParams = unknown, TResult = unknown> {
  name: string;
  description: string;
  category: ToolCategory;
  permission: ToolPermission;
  validate?: (params: TParams) => string | null;
  execute: (params: TParams) => TResult;
}

export interface ToolResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  register<TParams, TResult>(def: ToolDefinition<TParams, TResult>): void {
    if (this.tools.has(def.name)) return;
    this.tools.set(def.name, def as ToolDefinition);
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  getAll(): ToolDefinition[] {
    return [...this.tools.values()];
  }

  getByCategory(cat: ToolCategory): ToolDefinition[] {
    return [...this.tools.values()].filter((t) => t.category === cat);
  }

  execute<TParams, TResult>(name: string, params: TParams): ToolResult<TResult> {
    const tool = this.tools.get(name);
    if (!tool) return { success: false, error: `Unknown tool: "${name}"` };

    if (tool.validate) {
      const err = tool.validate(params);
      if (err) return { success: false, error: err };
    }

    try {
      const data = tool.execute(params) as TResult;
      return { success: true, data };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  }
}

export const globalToolRegistry = new ToolRegistry();
