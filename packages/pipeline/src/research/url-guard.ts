import dns from 'node:dns/promises';
import net from 'node:net';

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsafeUrlError';
  }
}

const PRIVATE_IPV4_RANGES: [string, number][] = [
  ['10.0.0.0', 8],
  ['172.16.0.0', 12],
  ['192.168.0.0', 16],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16], // link-local, incl. cloud metadata endpoint 169.254.169.254
  ['0.0.0.0', 8],
];

function ipToInt(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;
}

function isPrivateIpv4(ip: string): boolean {
  const target = ipToInt(ip);
  return PRIVATE_IPV4_RANGES.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (ipToInt(base) & mask) === (target & mask);
  });
}

function isPrivateIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  return (
    lower === '::1' || // loopback
    lower.startsWith('fc') ||
    lower.startsWith('fd') || // unique local
    lower.startsWith('fe80') // link-local
  );
}

export interface UrlGuardOptions {
  /** Allows loopback/private hosts - needed only for the batch grader's local fixture server. */
  allowLoopback: boolean;
}

/**
 * Validates a URL is safe to fetch: http/https only, and (unless explicitly
 * allowed for local grading) the resolved address is not a private/loopback/
 * link-local range - the standard SSRF guard for a server that fetches
 * arbitrary user-supplied URLs.
 */
export async function assertSafeUrl(rawUrl: string, options: UrlGuardOptions): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UnsafeUrlError(`Invalid URL: ${rawUrl}`);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new UnsafeUrlError(`Unsupported protocol: ${url.protocol}`);
  }

  if (options.allowLoopback) {
    return url;
  }

  const hostname = url.hostname;
  if (hostname === 'localhost') {
    throw new UnsafeUrlError('Refusing to fetch localhost in this environment');
  }

  if (net.isIP(hostname)) {
    if (net.isIPv4(hostname) && isPrivateIpv4(hostname)) {
      throw new UnsafeUrlError(`Refusing to fetch private/loopback address: ${hostname}`);
    }
    if (net.isIPv6(hostname) && isPrivateIpv6(hostname)) {
      throw new UnsafeUrlError(`Refusing to fetch private/loopback address: ${hostname}`);
    }
    return url;
  }

  let addresses: string[];
  try {
    const records = await dns.lookup(hostname, { all: true });
    addresses = records.map((r) => r.address);
  } catch {
    throw new UnsafeUrlError(`Could not resolve host: ${hostname}`);
  }

  for (const address of addresses) {
    if (net.isIPv4(address) && isPrivateIpv4(address)) {
      throw new UnsafeUrlError(`${hostname} resolves to a private address (${address})`);
    }
    if (net.isIPv6(address) && isPrivateIpv6(address)) {
      throw new UnsafeUrlError(`${hostname} resolves to a private address (${address})`);
    }
  }

  return url;
}
