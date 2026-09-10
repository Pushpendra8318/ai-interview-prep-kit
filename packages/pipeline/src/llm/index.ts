import type { Env } from '@prepkit/config';
import { GeminiProvider } from './gemini.js';
import type { LLMProvider } from './types.js';

export * from './types.js';
export * from './prompt.js';
export * from './json-repair.js';
export * from './retry.js';
export { GeminiProvider } from './gemini.js';

export function createLLMProvider(env: Env): LLMProvider {
  switch (env.LLM_PROVIDER) {
    case 'gemini':
      return new GeminiProvider({
        apiKey: env.LLM_API_KEY,
        model: env.LLM_MODEL,
        maxRetries: env.LLM_MAX_RETRIES,
      });
    default:
      throw new Error(`Unsupported LLM_PROVIDER: ${env.LLM_PROVIDER}`);
  }
}
