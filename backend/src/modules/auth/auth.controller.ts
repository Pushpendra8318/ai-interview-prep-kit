import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { UserModel } from '@prepkit/db';
import { LoginRequestSchema, RegisterRequestSchema } from '@prepkit/schema';
import type { Env } from '@prepkit/config';
import { HttpError } from '../../gateway/http-error.js';
import {
  clearSessionCookie,
  createSession,
  destroySession,
  setSessionCookie,
  SESSION_COOKIE_NAME,
} from './session.js';

const BCRYPT_ROUNDS = 12;

/** Controller layer: HTTP request/response handling only - business rules live in the Model (packages/db) and this module's session helpers. */
export const authController = (env: Env) => ({
  async register(req: Request, res: Response) {
    const { name, email, password } = RegisterRequestSchema.parse(req.body);
    const existing = await UserModel.findOne({ email: email.toLowerCase() }).lean();
    if (existing) {
      throw new HttpError(409, 'CONFLICT', 'An account with this email already exists');
    }
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await UserModel.create({ name, email: email.toLowerCase(), passwordHash });
    const { token, expiresAt } = await createSession(user._id.toString(), req.header('user-agent'));
    setSessionCookie(res, token, expiresAt, env);
    res.status(201).json({
      success: true,
      data: { id: user._id.toString(), name: user.name, email: user.email },
      requestId: req.requestId,
    });
  },

  async login(req: Request, res: Response) {
    const { email, password } = LoginRequestSchema.parse(req.body);
    const user = await UserModel.findOne({ email: email.toLowerCase() });
    const invalidCreds = () => HttpError.unauthenticated('Invalid email or password');
    if (!user) throw invalidCreds();
    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) throw invalidCreds();

    const { token, expiresAt } = await createSession(user._id.toString(), req.header('user-agent'));
    setSessionCookie(res, token, expiresAt, env);
    res.json({
      success: true,
      data: { id: user._id.toString(), name: user.name, email: user.email },
      requestId: req.requestId,
    });
  },

  async logout(req: Request, res: Response) {
    const token = req.cookies?.[SESSION_COOKIE_NAME];
    if (token) await destroySession(token);
    clearSessionCookie(res, env);
    res.json({ success: true, data: { loggedOut: true }, requestId: req.requestId });
  },

  async me(req: Request, res: Response) {
    const user = await UserModel.findById(req.userId).lean();
    if (!user) throw HttpError.unauthenticated();
    res.json({
      success: true,
      data: { id: user._id.toString(), name: user.name, email: user.email },
      requestId: req.requestId,
    });
  },
});
