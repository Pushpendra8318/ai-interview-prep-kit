/**
 * Deterministic link-ranking heuristic (brief §2/§10): companies bury their
 * hiring/engineering-culture pages in unpredictable places, so a fixed list
 * of paths ("/careers", "/jobs", "/about") is not sufficient. Instead every
 * link discovered while crawling is scored from its anchor text, URL path
 * and (once fetched) page title, and the highest scorers are the ones
 * actually fetched next.
 */

export interface CrawlLink {
  url: string;
  anchorText: string;
}

export interface RankedLink extends CrawlLink {
  score: number;
}

const KEYWORD_WEIGHTS: Record<string, number> = {
  interview: 14,
  interviewing: 14,
  'how-we-hire': 13,
  hiring: 12,
  recruiting: 8,
  careers: 10,
  jobs: 10,
  engineering: 7,
  handbook: 7,
  culture: 5,
  about: 5,
  team: 3,
  blog: 3,
  life: 2,
};

function scoreText(text: string): number {
  const lower = text.toLowerCase();
  let score = 0;
  for (const [keyword, weight] of Object.entries(KEYWORD_WEIGHTS)) {
    if (lower.includes(keyword)) score += weight;
  }
  return score;
}

/** Scores a single link from its anchor text, URL path, and (if known) page title. */
export function scoreLink(link: CrawlLink & { pageTitle?: string }): number {
  let path = '';
  try {
    path = new URL(link.url).pathname;
  } catch {
    path = link.url;
  }

  let score = scoreText(link.anchorText) + scoreText(path) + scoreText(link.pageTitle ?? '');

  // Mild penalty for very deep paths - hiring/culture pages are rarely buried
  // more than a few segments deep, and this keeps runaway crawls from ranking
  // low-value leaf pages highly just by keyword coincidence.
  const depth = path.split('/').filter(Boolean).length;
  if (depth > 3) score -= (depth - 3) * 2;

  return score;
}

export interface RankLinksOptions {
  maxLinks: number;
}

/** Ranks, dedupes and caps a set of discovered links to the ones worth fetching. */
export function rankLinks(links: CrawlLink[], options: RankLinksOptions): RankedLink[] {
  const seen = new Set<string>();
  const ranked: RankedLink[] = [];

  for (const link of links) {
    let normalized: string;
    try {
      const u = new URL(link.url);
      u.hash = '';
      normalized = u.toString();
    } catch {
      continue;
    }
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    ranked.push({ url: normalized, anchorText: link.anchorText, score: scoreLink(link) });
  }

  return ranked
    .filter((l) => l.score > 0)
    .sort((a, b) => b.score - a.score || a.url.localeCompare(b.url))
    .slice(0, options.maxLinks);
}

export function classifySource(
  urlOrTitle: string,
): 'careers' | 'engineering' | 'interview-process' | 'about' | 'other' {
  const lower = urlOrTitle.toLowerCase();
  if (/(interview|how-we-hire)/.test(lower)) return 'interview-process';
  if (/(career|jobs|hiring|recruiting)/.test(lower)) return 'careers';
  if (/(engineering|handbook|tech-blog)/.test(lower)) return 'engineering';
  if (/(about|culture|team)/.test(lower)) return 'about';
  return 'other';
}
