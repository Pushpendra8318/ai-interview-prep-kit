function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Simple per-host minimum-interval limiter - keeps the crawler polite without needing Redis. */
export class HostRateLimiter {
  private lastRequestAt = new Map<string, number>();

  constructor(private readonly minIntervalMs: number) {}

  async wait(host: string): Promise<void> {
    const last = this.lastRequestAt.get(host);
    const now = Date.now();
    if (last !== undefined) {
      const elapsed = now - last;
      if (elapsed < this.minIntervalMs) {
        await sleep(this.minIntervalMs - elapsed);
      }
    }
    this.lastRequestAt.set(host, Date.now());
  }
}
