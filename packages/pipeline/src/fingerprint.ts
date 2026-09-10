import { createHash } from 'node:crypto';

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url.trim());
    u.hash = '';
    let path = u.pathname.replace(/\/+$/, '');
    if (path === '') path = '/';
    return `${u.hostname.toLowerCase()}${path}`;
  } catch {
    return normalize(url);
  }
}

/** Deterministic fingerprint used to detect the same JD+company submitted twice. */
export function computeFingerprint(jd: string, companyUrl: string): string {
  const payload = `${normalize(jd)}|${normalizeUrl(companyUrl)}`;
  return createHash('sha256').update(payload).digest('hex');
}
