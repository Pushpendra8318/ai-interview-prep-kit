import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(4000),

  // Optional at the env-parsing layer: the batch CLI (scripts/evaluate.ts) runs the
  // pipeline directly and never touches Mongo/sessions, so it shouldn't need these
  // configured. backend's server.ts still requires a real MONGODB_URI at connect time.
  MONGODB_URI: z.string().default(''),
  SESSION_SECRET: z.string().default('dev-only-insecure-secret-change-me'),

  LLM_PROVIDER: z.enum(['gemini']).default('gemini'),
  LLM_API_KEY: z.string().min(1, 'LLM_API_KEY is required'),
  LLM_MODEL: z.string().default('gemini-flash-lite-latest'),
  LLM_MAX_RETRIES: z.coerce.number().int().min(0).default(3),

  SEARCH_API_KEY: z.string().optional(),

  FRONTEND_URL: z.string().default('http://localhost:3000'),

  MAX_CRAWL_PAGES: z.coerce.number().int().min(1).default(6),
  CRAWL_TIMEOUT_MS: z.coerce.number().int().min(1000).default(8000),
  MAX_RESPONSE_SIZE: z.coerce.number().int().min(1024).default(5_000_000),

  COVERAGE_MAX_PASSES: z.coerce.number().int().min(1).max(5).default(3),

  /** Allows crawling loopback/private hosts (needed for the batch grader's localhost fixture). */
  EVAL_ALLOW_LOCALHOST: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | undefined;

/** Parses process.env once (cached) and throws a clear error listing every missing/invalid var. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cached) return cached;
  const result = EnvSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cached = result.data;
  return cached;
}

/** Test-only helper to reset the cache between test files. */
export function resetEnvCache(): void {
  cached = undefined;
}

export function allowsLoopback(env: Env): boolean {
  return env.NODE_ENV !== 'production' || env.EVAL_ALLOW_LOCALHOST === true;
}
