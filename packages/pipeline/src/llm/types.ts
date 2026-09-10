export interface GenerateJsonParams {
  prompt: string;
  /** JSON-schema-ish hint some providers (Gemini) can enforce natively. Best-effort elsewhere. */
  responseSchema?: Record<string, unknown>;
  maxOutputTokens?: number;
}

export interface LLMProvider {
  readonly name: string;
  generateJson(params: GenerateJsonParams): Promise<string>;
}

export class LLMUnavailableError extends Error {
  constructor(
    message: string,
    override readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'LLMUnavailableError';
  }
}
