import * as cheerio from 'cheerio';
import type { CrawlLink } from './link-rank.js';

export interface ParsedPage {
  title: string;
  text: string;
  links: CrawlLink[];
}

const NOISE_TAGS = ['script', 'style', 'noscript', 'svg', 'nav', 'footer'];

/** Parses raw HTML into clean visible text plus same-origin absolute links. */
export function parseHtml(html: string, baseUrl: string): ParsedPage {
  const $ = cheerio.load(html);
  NOISE_TAGS.forEach((tag) => $(tag).remove());

  const title = $('title').first().text().trim();
  const text = $('body').text().replace(/\s+/g, ' ').trim();

  const base = new URL(baseUrl);
  const links: CrawlLink[] = [];
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:'))
      return;
    try {
      const resolved = new URL(href, base);
      if (resolved.hostname !== base.hostname) return; // same-origin only
      resolved.hash = '';
      links.push({ url: resolved.toString(), anchorText: $(el).text().trim() });
    } catch {
      /* ignore malformed hrefs */
    }
  });

  return { title, text, links };
}
