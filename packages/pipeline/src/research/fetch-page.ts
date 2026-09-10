import { assertSafeUrl } from './url-guard.js';

export type FetchFailureReason =
  | 'TIMEOUT'
  | 'NOT_FOUND'
  | 'SSRF_BLOCKED'
  | 'SIZE_EXCEEDED'
  | 'BAD_CONTENT_TYPE'
  | 'BLOCKED_BY_ROBOTS'
  | 'NETWORK_ERROR'
  | 'TOO_MANY_REDIRECTS';

export class FetchPageError extends Error {
  constructor(
    readonly reason: FetchFailureReason,
    message: string,
  ) {
    super(message);
    this.name = 'FetchPageError';
  }
}

export interface FetchPageOptions {
  timeoutMs: number;
  maxBytes: number;
  allowLoopback: boolean;
  maxRedirects?: number;
  allowedContentTypes?: RegExp;
}

export interface FetchedPage {
  url: string;
  finalUrl: string;
  status: number;
  contentType: string;
  body: string;
}

const DEFAULT_ALLOWED_CONTENT_TYPES = /^(text\/html|text\/plain)/i;

/**
 * Fetches a single page with every guard the brief's security section
 * requires: SSRF validation (re-checked on every redirect hop, not just the
 * initial URL), a hard timeout, a streamed response-size cap, and a
 * content-type allowlist. Never throws for the pipeline as a whole - callers
 * catch FetchPageError and record it as a failed research_source.
 */
export async function fetchPage(rawUrl: string, options: FetchPageOptions): Promise<FetchedPage> {
  const maxRedirects = options.maxRedirects ?? 3;
  const allowedContentTypes = options.allowedContentTypes ?? DEFAULT_ALLOWED_CONTENT_TYPES;

  let currentUrl = rawUrl;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const safeUrl = await assertSafeUrl(currentUrl, { allowLoopback: options.allowLoopback }).catch(
      () => {
        throw new FetchPageError('SSRF_BLOCKED', `Refused to fetch unsafe URL: ${currentUrl}`);
      },
    );

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs);

    let response: Response;
    try {
      response = await fetch(safeUrl, {
        redirect: 'manual',
        signal: controller.signal,
        headers: { 'User-Agent': 'AIInterviewPrepKitBot/1.0 (+respects robots.txt)' },
      });
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        throw new FetchPageError('TIMEOUT', `Timed out fetching ${currentUrl}`);
      }
      throw new FetchPageError(
        'NETWORK_ERROR',
        `Network error fetching ${currentUrl}: ${(error as Error).message}`,
      );
    } finally {
      clearTimeout(timer);
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) {
        throw new FetchPageError(
          'NETWORK_ERROR',
          `Redirect with no Location header from ${currentUrl}`,
        );
      }
      currentUrl = new URL(location, safeUrl).toString();
      continue;
    }

    if (response.status === 404) {
      throw new FetchPageError('NOT_FOUND', `${currentUrl} returned 404`);
    }
    if (!response.ok) {
      throw new FetchPageError('NETWORK_ERROR', `${currentUrl} returned status ${response.status}`);
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!allowedContentTypes.test(contentType)) {
      throw new FetchPageError(
        'BAD_CONTENT_TYPE',
        `Unexpected content-type "${contentType}" for ${currentUrl}`,
      );
    }

    // Note: no early reject on the Content-Length header here - large real
    // company sites (heavy inline JSON/scripts before markup even starts)
    // regularly exceed any fixed cap, and rejecting the whole page throws
    // away content that's still useful once truncated. readBodyWithLimit
    // below still hard-caps total bytes actually downloaded either way.
    const body = await readBodyWithLimit(response, options.maxBytes, currentUrl);

    return { url: rawUrl, finalUrl: currentUrl, status: response.status, contentType, body };
  }

  throw new FetchPageError(
    'TOO_MANY_REDIRECTS',
    `Exceeded ${maxRedirects} redirects starting from ${rawUrl}`,
  );
}

/**
 * Reads the response body up to maxBytes and truncates rather than
 * rejecting once the cap is hit - a company homepage that's mostly inline
 * scripts/JSON before any real markup still has a company name, a title,
 * and a handful of usable links in its first couple of megabytes. Silently
 * throwing the whole page away because it happens to be large produces an
 * honest-looking but avoidably empty company brief.
 */
async function readBodyWithLimit(response: Response, maxBytes: number, _url: string): Promise<string> {
  if (!response.body) return response.text();

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      const remaining = maxBytes - total;
      if (remaining <= 0) {
        await reader.cancel();
        break;
      }
      chunks.push(remaining < value.byteLength ? value.subarray(0, remaining) : value);
      total += value.byteLength;
    }
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf-8');
}
