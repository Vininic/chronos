import { GoogleGenerativeAI } from "@google/generative-ai";
import type { LLMProvider, LLMProviderConfig, GenerateOptions, GenerateResult, ProviderId } from "../provider";

export class GeminiAdapter implements LLMProvider {
  readonly id: ProviderId = "gemini";
  readonly displayName = "Gemini";
  readonly models = ["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-3.1-flash-lite", "gemini-1.5-pro", "gemini-1.5-flash"];
  readonly defaultModel = "gemini-3.1-flash-lite";
  readonly supportsStreaming = true;
  readonly supportsFunctionCalling = true;
  readonly requiresApiKey = true;

  private client: GoogleGenerativeAI;
  private configData: LLMProviderConfig;

  constructor(config: LLMProviderConfig) {
    this.configData = { ...config, model: config.model ?? this.defaultModel };
    this.client = new GoogleGenerativeAI(config.apiKey);
  }

  config(): LLMProviderConfig {
    return { ...this.configData };
  }

  async generateContent(prompt: string, options?: GenerateOptions): Promise<GenerateResult> {
    const model = this.client.getGenerativeModel({
      model: this.configData.model ?? this.defaultModel,
    });

    const contents: { role: "user" | "model"; parts: { text: string }[] }[] = [];
    if (options?.systemPrompt) {
      contents.push({ role: "user", parts: [{ text: options.systemPrompt }] });
    }
    contents.push({ role: "user", parts: [{ text: prompt }] });

    const result = await model.generateContent({
      contents,
      generationConfig: {
        temperature: options?.temperature ?? 0.7,
        maxOutputTokens: options?.maxTokens ?? 4096,
      },
    });

    const response = result.response;
    return {
      text: response.text(),
      finishReason: response.candidates?.[0]?.finishReason ?? "stop",
      usage: {
        promptTokens: response.usageMetadata?.promptTokenCount ?? 0,
        completionTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
        totalTokens: response.usageMetadata?.totalTokenCount ?? 0,
      },
    };
  }

  async *generateContentStream(prompt: string, options?: GenerateOptions): AsyncIterable<string> {
    const model = this.client.getGenerativeModel({
      model: this.configData.model ?? this.defaultModel,
    });

    const contents: { role: "user" | "model"; parts: { text: string }[] }[] = [];
    if (options?.systemPrompt) {
      contents.push({ role: "user", parts: [{ text: options.systemPrompt }] });
    }
    contents.push({ role: "user", parts: [{ text: prompt }] });

    const result = await model.generateContentStream({
      contents,
      generationConfig: {
        temperature: options?.temperature ?? 0.7,
        maxOutputTokens: options?.maxTokens ?? 4096,
      },
    });

    for await (const chunk of result.stream) {
      yield chunk.text();
    }
  }
}
