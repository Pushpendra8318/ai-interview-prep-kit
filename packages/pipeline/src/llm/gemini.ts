import { GoogleGenerativeAI } from '@google/generative-ai';
import { withBackoff } from './retry.js';
import type { GenerateJsonParams, LLMProvider } from './types.js';
import { LLMUnavailableError } from './types.js';

export interface GeminiProviderOptions {
  apiKey: string;
  model: string;
  maxRetries: number;
}

/** Google Gemini implementation - genuine free tier, native JSON-mode via responseMimeType. */
export class GeminiProvider implements LLMProvider {
  readonly name = 'gemini';
  private readonly client: GoogleGenerativeAI;
  private readonly modelName: string;
  private readonly maxRetries: number;

  constructor(options: GeminiProviderOptions) {
    this.client = new GoogleGenerativeAI(options.apiKey);
    this.modelName = options.model;
    this.maxRetries = options.maxRetries;
  }

  async generateJson(params: GenerateJsonParams): Promise<string> {
    const model = this.client.getGenerativeModel({
      model: this.modelName,
      generationConfig: {
        responseMimeType: 'application/json',
        ...(params.responseSchema ? { responseSchema: params.responseSchema } : {}),
        maxOutputTokens: params.maxOutputTokens ?? 4096,
        temperature: 0.4,
      },
    });

    try {
      const result = await withBackoff(() => model.generateContent(params.prompt), {
        maxRetries: this.maxRetries,
      });
      const text = result.response.text();
      if (!text) {
        throw new LLMUnavailableError('Gemini returned an empty response');
      }
      return text;
    } catch (error) {
      if (error instanceof LLMUnavailableError) throw error;
      const detail = error instanceof Error ? error.message : String(error);
      throw new LLMUnavailableError(`Gemini call failed: ${detail}`, error);
    }
  }
}
