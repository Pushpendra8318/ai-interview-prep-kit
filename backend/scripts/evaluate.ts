import 'dotenv/config';
import { readFile, writeFile } from 'node:fs/promises';
import { allowsLoopback } from '@prepkit/config';
import { PipelineError, runPipeline } from '@prepkit/pipeline';
import {
  BatchInputSchema,
  type BatchCase,
  type BatchErrorCode,
  type BatchKitResult,
  type BatchOutput,
} from '@prepkit/schema';
import { getEnv, getProvider } from '../src/context.js';

/**
 * Mandatory batch entry point (brief §9): `npm run evaluate -- --input
 * cases.json --output kits.json`. Calls the exact same `runPipeline` the
 * in-process job runner uses - no parallel implementation - so behaviour
 * here matches the web app pipeline exactly.
 */

function parseArgs(argv: string[]): { input: string; output: string } {
  let input: string | undefined;
  let output: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--input') input = argv[++i];
    else if (argv[i] === '--output') output = argv[++i];
  }
  if (!input || !output) {
    throw new Error('Usage: npm run evaluate -- --input <cases.json> --output <kits.json>');
  }
  return { input, output };
}

function errorCodeFrom(error: unknown): BatchErrorCode {
  if (error instanceof PipelineError) {
    if (error.code === 'INVALID_CASE') return 'INVALID_CASE';
    if (error.code === 'COMPANY_UNREACHABLE') return 'COMPANY_UNREACHABLE';
    if (error.code === 'LLM_UNAVAILABLE') return 'LLM_UNAVAILABLE';
    return 'GENERATION_FAILED';
  }
  return 'UNKNOWN';
}

async function runCase(
  batchCase: BatchCase,
  provider: ReturnType<typeof getProvider>,
  env: ReturnType<typeof getEnv>,
): Promise<BatchKitResult> {
  try {
    const { kit } = await runPipeline(
      { jd: batchCase.jd, companyUrl: batchCase.company_url, days: batchCase.days },
      {
        provider,
        maxCrawlPages: env.MAX_CRAWL_PAGES,
        crawlTimeoutMs: env.CRAWL_TIMEOUT_MS,
        maxResponseBytes: env.MAX_RESPONSE_SIZE,
        searchApiKey: env.SEARCH_API_KEY,
        coverageMaxPasses: env.COVERAGE_MAX_PASSES,
        allowLoopback: allowsLoopback(env),
      },
    );
    return { id: batchCase.id, status: 'ok', kit, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      id: batchCase.id,
      status: 'failed',
      kit: null,
      error: { code: errorCodeFrom(error), message },
    };
  }
}

/** Bounded concurrency so free-tier LLM/search rate limits aren't hit all at once. */
async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  async function worker() {
    for (;;) {
      const i = nextIndex++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) || 1 }, worker));
  return results;
}

async function main() {
  const { input, output } = parseArgs(process.argv.slice(2));
  const raw = JSON.parse(await readFile(input, 'utf-8'));
  const cases = BatchInputSchema.parse(raw);

  const env = getEnv();
  const provider = getProvider();

  console.log(`Running ${cases.length} case(s) through the pipeline...`);
  const kits = await runWithConcurrency(cases, 2, (c) => runCase(c, provider, env));

  const okCount = kits.filter((k) => k.status === 'ok').length;
  console.log(`Done: ${okCount} ok, ${kits.length - okCount} failed.`);

  const result: BatchOutput = {
    version: '1.0',
    generated_at: new Date().toISOString(),
    kits,
  };
  await writeFile(output, JSON.stringify(result, null, 2), 'utf-8');
  console.log(`Wrote results to ${output}`);
}

main().catch((error) => {
  console.error('evaluate failed:', error);
  process.exit(1);
});
