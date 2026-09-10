import { describe, expect, it } from 'vitest';
import { assertSafeUrl, UnsafeUrlError } from './url-guard.js';

describe('assertSafeUrl', () => {
  it('rejects non-http(s) protocols', async () => {
    await expect(assertSafeUrl('ftp://example.com', { allowLoopback: false })).rejects.toThrow(
      UnsafeUrlError,
    );
  });

  it('rejects malformed URLs', async () => {
    await expect(assertSafeUrl('not a url', { allowLoopback: false })).rejects.toThrow(
      UnsafeUrlError,
    );
  });

  it('rejects loopback IP literals when not allowed', async () => {
    await expect(
      assertSafeUrl('http://127.0.0.1:8099/acme/', { allowLoopback: false }),
    ).rejects.toThrow(UnsafeUrlError);
  });

  it('rejects the localhost hostname when not allowed', async () => {
    await expect(
      assertSafeUrl('http://localhost:8099/acme/', { allowLoopback: false }),
    ).rejects.toThrow(UnsafeUrlError);
  });

  it('rejects private-range IP literals (10.x, 192.168.x, cloud metadata)', async () => {
    await expect(assertSafeUrl('http://10.0.0.5/', { allowLoopback: false })).rejects.toThrow(
      UnsafeUrlError,
    );
    await expect(assertSafeUrl('http://192.168.1.1/', { allowLoopback: false })).rejects.toThrow(
      UnsafeUrlError,
    );
    await expect(
      assertSafeUrl('http://169.254.169.254/', { allowLoopback: false }),
    ).rejects.toThrow(UnsafeUrlError);
  });

  it('allows a public-looking IP literal', async () => {
    const url = await assertSafeUrl('http://93.184.216.34/', { allowLoopback: false });
    expect(url.hostname).toBe('93.184.216.34');
  });

  it('allows loopback when explicitly enabled (batch grader localhost fixture)', async () => {
    const url = await assertSafeUrl('http://localhost:8099/acme/', { allowLoopback: true });
    expect(url.hostname).toBe('localhost');
    const url2 = await assertSafeUrl('http://127.0.0.1:8099/acme/', { allowLoopback: true });
    expect(url2.hostname).toBe('127.0.0.1');
  });
});
