import { afterEach, describe, expect, it } from 'vitest';
import { allowsLoopback, loadEnv, resetEnvCache } from './index.js';

afterEach(() => {
  resetEnvCache();
});

const REQUIRED = { LLM_API_KEY: 'test-key' };

describe('loadEnv', () => {
  it('applies sane defaults when only the required vars are set', () => {
    const env = loadEnv({ ...REQUIRED });
    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(4000);
    expect(env.LLM_PROVIDER).toBe('gemini');
    expect(env.MAX_CRAWL_PAGES).toBe(6);
    expect(env.COVERAGE_MAX_PASSES).toBe(3);
  });

  it('throws a clear error listing every missing/invalid var', () => {
    expect(() => loadEnv({ NODE_ENV: 'production' })).toThrow(/LLM_API_KEY/);
  });

  it('coerces numeric env vars from strings', () => {
    const env = loadEnv({ ...REQUIRED, PORT: '5000', MAX_CRAWL_PAGES: '10' });
    expect(env.PORT).toBe(5000);
    expect(env.MAX_CRAWL_PAGES).toBe(10);
  });
});

describe('allowsLoopback', () => {
  it('allows loopback outside production', () => {
    const env = loadEnv({ ...REQUIRED, NODE_ENV: 'development' });
    expect(allowsLoopback(env)).toBe(true);
  });

  it('blocks loopback in production unless explicitly opted in', () => {
    const env = loadEnv({ ...REQUIRED, NODE_ENV: 'production' });
    expect(allowsLoopback(env)).toBe(false);
  });

  it('allows loopback in production when EVAL_ALLOW_LOCALHOST=true (batch grader)', () => {
    const env = loadEnv({ ...REQUIRED, NODE_ENV: 'production', EVAL_ALLOW_LOCALHOST: 'true' });
    expect(allowsLoopback(env)).toBe(true);
  });
});
