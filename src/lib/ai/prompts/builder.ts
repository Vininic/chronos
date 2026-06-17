import { versionedBlocks, type PromptBlock, type PromptVersion } from "./v1";

export type PromptBlockName =
  | "persona"
  | "tools"
  | "rules"
  | "context"
  | "conversation"
  | "instructions";

export class PromptBuilder {
  private blocks: { name: PromptBlockName; text: string }[] = [];

  addBlock(name: PromptBlockName, text: string): this {
    this.blocks.push({ name, text });
    return this;
  }

  addVersionedBlock(name: PromptBlockName, version?: string): this {
    const blocks = versionedBlocks.filter((b) => b.name === name);
    if (blocks.length === 0) return this;
    const block = version
      ? blocks.find((b) => b.version === version) ?? blocks[blocks.length - 1]
      : blocks[blocks.length - 1];
    this.blocks.push({ name, text: block.text });
    return this;
  }

  build(): string {
    return this.blocks.map((b) => b.text).join("\n\n");
  }

  static chatSystemPrompt(version?: string): string {
    return new PromptBuilder()
      .addVersionedBlock("persona", version)
      .addVersionedBlock("tools", version)
      .addVersionedBlock("rules", version)
      .build();
  }
}
