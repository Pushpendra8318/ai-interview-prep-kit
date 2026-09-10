import { fetchPage } from './fetch-page.js';

export interface RobotsRules {
  isAllowed(path: string): boolean;
}

const ALLOW_ALL: RobotsRules = { isAllowed: () => true };

/**
 * Best-effort robots.txt fetch + minimal parser (User-agent: * / Disallow
 * only - sufficient for the "respect robots.txt" requirement without pulling
 * in a full spec-compliant parser). Any failure to fetch/parse it is treated
 * as "no restrictions recorded" rather than blocking the whole crawl.
 */
export async function fetchRobotsRules(
  origin: string,
  options: { timeoutMs: number; allowLoopback: boolean },
): Promise<RobotsRules> {
  try {
    const page = await fetchPage(new URL('/robots.txt', origin).toString(), {
      timeoutMs: options.timeoutMs,
      maxBytes: 200_000,
      allowLoopback: options.allowLoopback,
      allowedContentTypes: /^text\//i,
    });
    return parseRobotsTxt(page.body);
  } catch {
    return ALLOW_ALL;
  }
}

export function parseRobotsTxt(text: string): RobotsRules {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const disallowedForAll: string[] = [];
  let inWildcardBlock = false;

  for (const line of lines) {
    if (!line || line.startsWith('#')) continue;
    const [rawKey, ...rest] = line.split(':');
    const key = rawKey?.trim().toLowerCase();
    const value = rest.join(':').trim();

    if (key === 'user-agent') {
      inWildcardBlock = value === '*';
    } else if (key === 'disallow' && inWildcardBlock && value) {
      disallowedForAll.push(value);
    }
  }

  return {
    isAllowed(path: string): boolean {
      return !disallowedForAll.some((rule) => path.startsWith(rule));
    },
  };
}
