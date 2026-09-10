export interface BackoffOptions {
  maxRetries: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  isRetryable?: (error: unknown) => boolean;
}

function defaultIsRetryable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const status =
    (error as { status?: number; statusCode?: number })?.status ??
    (error as { statusCode?: number })?.statusCode;
  if (status === 429 || (typeof status === 'number' && status >= 500)) return true;
  return /rate.?limit|429|quota|unavailable|ECONNRESET|ETIMEDOUT/i.test(message);
}

/**
 * Free-tier 429 responses (Gemini included) often say exactly how long to
 * wait before the per-minute quota resets - e.g. "Please retry in 47.9s" or
 * a structured RetryInfo.retryDelay of "47s". Honoring that beats guessing
 * with pure exponential backoff, since a short backoff just re-hits the same
 * quota window and burns through the retry budget for nothing.
 */
function parseSuggestedDelayMs(error: unknown): number | undefined {
  const message = error instanceof Error ? error.message : String(error);
  const seconds = message.match(/retry in ([\d.]+)\s*s/i)?.[1] ?? message.match(/"retryDelay":"(\d+)s"/)?.[1];
  if (!seconds) return undefined;
  const ms = Math.ceil(Number(seconds) * 1000);
  return Number.isFinite(ms) && ms > 0 ? ms : undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Exponential backoff with jitter for provider calls that free-tier LLM/
 * search APIs will periodically rate-limit or briefly fail (brief: "a
 * pipeline that falls over the first time a provider says 'slow down' is
 * the most common way to lose points here"). When the provider tells us
 * exactly how long to wait (as Gemini's 429 responses do), that takes
 * priority over the generic exponential curve.
 */
export async function withBackoff<T>(fn: () => Promise<T>, options: BackoffOptions): Promise<T> {
  const { maxRetries, baseDelayMs = 500, maxDelayMs = 60_000, isRetryable = defaultIsRetryable } = options;
  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (error) {
      attempt++;
      if (attempt > maxRetries || !isRetryable(error)) {
        throw error;
      }
      const suggested = parseSuggestedDelayMs(error);
      const exponential = baseDelayMs * 2 ** (attempt - 1) + Math.floor(Math.random() * baseDelayMs);
      const delay = Math.min(suggested ?? exponential, maxDelayMs);
      await sleep(delay);
    }
  }
}
