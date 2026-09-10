import type { NextFunction, Request, Response } from 'express';
import { SESSION_COOKIE_NAME, resolveSession } from '../modules/auth/session.js';
import { HttpError } from './http-error.js';

/** Derives identity from the session cookie only - a request body/query `userId` is never trusted. */
export function requireAuth() {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const token = req.cookies?.[SESSION_COOKIE_NAME];
    if (!token) {
      next(HttpError.unauthenticated());
      return;
    }
    const session = await resolveSession(token);
    if (!session) {
      next(HttpError.unauthenticated('Session expired or invalid'));
      return;
    }
    req.userId = session.userId;
    next();
  };
}
