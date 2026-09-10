import express, { type Express } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import type { Env } from '@prepkit/config';
import { requestIdMiddleware } from './gateway/request-id.js';
import { errorHandler } from './gateway/error-handler.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { kitsRouter } from './modules/kits/kits.routes.js';
import { practiceRouter } from './modules/practice/practice.routes.js';

export function createApp(env: Env): Express {
  const app = express();

  app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(requestIdMiddleware);

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  app.use('/api/v1/auth', authRouter(env));
  app.use('/api/v1/kits', kitsRouter());
  app.use('/api/v1/kits/:kitId/practice', practiceRouter());

  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.path}` },
      requestId: req.requestId,
    });
  });

  app.use(errorHandler);

  return app;
}
