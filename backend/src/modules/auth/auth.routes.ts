import { Router } from 'express';
import type { Env } from '@prepkit/config';
import { asyncHandler } from '../../gateway/async-handler.js';
import { requireAuth } from '../../gateway/auth-middleware.js';
import { authController } from './auth.controller.js';

/** Routes: URL -> Controller wiring only. */
export function authRouter(env: Env): Router {
  const router = Router();
  const controller = authController(env);

  router.post('/register', asyncHandler(controller.register));
  router.post('/login', asyncHandler(controller.login));
  router.post('/logout', asyncHandler(controller.logout));
  router.get('/me', requireAuth(), asyncHandler(controller.me));

  return router;
}
