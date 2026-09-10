import { randomBytes, createHash } from 'node:crypto';
import type { Response } from 'express';
import { SessionModel } from '@prepkit/db';
import type { Env } from '@prepkit/config';

export const SESSION_COOKIE_NAME = 'session_token';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createSession(
  userId: string,
  userAgent: string | undefined,
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await SessionModel.create({ userId, tokenHash: hashToken(token), expiresAt, userAgent });
  return { token, expiresAt };
}

export async function destroySession(token: string): Promise<void> {
  await SessionModel.deleteOne({ tokenHash: hashToken(token) });
}

export async function resolveSession(token: string): Promise<{ userId: string } | null> {
  const session = await SessionModel.findOne({ tokenHash: hashToken(token) }).lean();
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) return null;
  return { userId: session.userId.toString() };
}

export function setSessionCookie(res: Response, token: string, expiresAt: Date, env: Env): void {
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
    expires: expiresAt,
    path: '/',
  });
}

export function clearSessionCookie(res: Response, env: Env): void {
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/',
  });
}
