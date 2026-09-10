import { fetchPage, FetchPageError, type FetchFailureReason } from './fetch-page.js';
import { parseHtml } from './html.js';
import { classifySource, rankLinks } from './link-rank.js';
import { HostRateLimiter } from './rate-limiter.js';
import { fetchRobotsRules } from './robots.js';

export type SourceKind =
  'homepage' | 'careers' | 'engineering' | 'interview-process' | 'about' | 'other';

export interface CrawledPage {
  url: string;
  title: string;
  text: string;
  sourceType: SourceKind;
}

export interface SourceRecord {
  url: string;
  title: string | null;
  sourceType: SourceKind;
  retrievalStatus: 'ok' | 'failed';
  retrievedAt: Date;
  extractedText: string | null;
  error: string | null;
}

export interface CrawlOptions {
  maxPages: number;
  timeoutMs: number;
  maxBytes: number;
  allowLoopback: boolean;
}

export interface CrawlResult {
  pages: CrawledPage[];
  sourceRecords: SourceRecord[];
}

function reasonToMessage(reason: FetchFailureReason): string {
  return reason;
}

/**
 * Crawls a company site: fetches the homepage, extracts links from it,
 * ranks them with the deterministic link-scoring heuristic (brief §2/§10 -
 * "a fixed list of paths is not sufficient"), and fetches the highest-scoring
 * pages up to `maxPages`. Every fetch attempt - success or failure - is
 * recorded as a SourceRecord so a single unreachable page never aborts the
 * whole run.
 */
export async function crawlCompanySite(
  companyUrl: string,
  options: CrawlOptions,
): Promise<CrawlResult> {
  const sourceRecords: SourceRecord[] = [];
  const pages: CrawledPage[] = [];
  const rateLimiter = new HostRateLimiter(500);

  let origin: string;
  try {
    origin = new URL(companyUrl).origin;
  } catch {
    sourceRecords.push({
      url: companyUrl,
      title: null,
      sourceType: 'other',
      retrievalStatus: 'failed',
      retrievedAt: new Date(),
      extractedText: null,
      error: 'INVALID_URL',
    });
    return { pages, sourceRecords };
  }

  const robots = await fetchRobotsRules(origin, {
    timeoutMs: options.timeoutMs,
    allowLoopback: options.allowLoopback,
  });

  await rateLimiter.wait(origin);
  try {
    const homepage = await fetchPage(companyUrl, {
      timeoutMs: options.timeoutMs,
      maxBytes: options.maxBytes,
      allowLoopback: options.allowLoopback,
    });
    const parsed = parseHtml(homepage.body, homepage.finalUrl);
    pages.push({
      url: homepage.finalUrl,
      title: parsed.title,
      text: parsed.text,
      sourceType: 'homepage',
    });
    sourceRecords.push({
      url: homepage.finalUrl,
      title: parsed.title || null,
      sourceType: 'homepage',
      retrievalStatus: 'ok',
      retrievedAt: new Date(),
      extractedText: parsed.text.slice(0, 5000),
      error: null,
    });

    const candidateLinks = parsed.links.filter((link) => {
      try {
        return robots.isAllowed(new URL(link.url).pathname);
      } catch {
        return false;
      }
    });
    const ranked = rankLinks(candidateLinks, { maxLinks: Math.max(0, options.maxPages - 1) });

    for (const link of ranked) {
      await rateLimiter.wait(origin);
      try {
        const page = await fetchPage(link.url, {
          timeoutMs: options.timeoutMs,
          maxBytes: options.maxBytes,
          allowLoopback: options.allowLoopback,
        });
        const parsedLinkPage = parseHtml(page.body, page.finalUrl);
        const sourceType = classifySource(`${page.finalUrl} ${parsedLinkPage.title}`);
        pages.push({
          url: page.finalUrl,
          title: parsedLinkPage.title,
          text: parsedLinkPage.text,
          sourceType,
        });
        sourceRecords.push({
          url: page.finalUrl,
          title: parsedLinkPage.title || null,
          sourceType,
          retrievalStatus: 'ok',
          retrievedAt: new Date(),
          extractedText: parsedLinkPage.text.slice(0, 5000),
          error: null,
        });
      } catch (error) {
        const reason = error instanceof FetchPageError ? error.reason : 'NETWORK_ERROR';
        sourceRecords.push({
          url: link.url,
          title: null,
          sourceType: classifySource(link.url),
          retrievalStatus: 'failed',
          retrievedAt: new Date(),
          extractedText: null,
          error: reasonToMessage(reason),
        });
      }
    }
  } catch (error) {
    const reason = error instanceof FetchPageError ? error.reason : 'NETWORK_ERROR';
    sourceRecords.push({
      url: companyUrl,
      title: null,
      sourceType: 'homepage',
      retrievalStatus: 'failed',
      retrievedAt: new Date(),
      extractedText: null,
      error: reasonToMessage(reason),
    });
  }

  return { pages, sourceRecords };
}
