export type ProviderId = "gemini" | "gemini-local" | "openai" | "anthropic" | "ollama" | "openrouter" | "openrouter-local";

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface FilePart {
  type: "text" | "image";
  data: string;
  mimeType: string;
}

export interface GenerateOptions {
  systemPrompt?: string;
  tools?: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  fileParts?: FilePart[];
}

export interface GenerateResult {
  text: string;
  finishReason: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface LLMProviderConfig {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  [key: string]: unknown;
}

export interface LLMProvider {
  readonly id: ProviderId;
  readonly displayName: string;
  readonly models: string[];
  readonly defaultModel: string;
  readonly supportsStreaming: boolean;
  readonly supportsFunctionCalling: boolean;
  readonly requiresApiKey: boolean;

  generateContent(prompt: string, options?: GenerateOptions): Promise<GenerateResult>;
  generateContentStream(prompt: string, options?: GenerateOptions): AsyncIterable<string>;

  config(): LLMProviderConfig;
}

export function buildProviderKey(key: string, provider: ProviderId): string {
  return `CHRONOS_${provider.toUpperCase()}_API_KEY`;
}
