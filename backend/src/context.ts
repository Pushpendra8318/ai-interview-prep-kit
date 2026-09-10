import { loadEnv, type Env } from '@prepkit/config';
import { createLLMProvider, type LLMProvider } from '@prepkit/pipeline';

let envCache: Env | undefined;
let providerCache: LLMProvider | undefined;

export function getEnv(): Env {
  if (!envCache) envCache = loadEnv();
  return envCache;
}

export function getProvider(): LLMProvider {
  if (!providerCache) providerCache = createLLMProvider(getEnv());
  return providerCache;
}
