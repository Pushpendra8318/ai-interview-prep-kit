import { Router } from 'express';
import { requireAuth } from '../../gateway/auth-middleware.js';
import { asyncHandler } from '../../gateway/async-handler.js';
import { practiceController as c } from './practice.controller.js';

export function practiceRouter(): Router {
  const router = Router({ mergeParams: true });
  router.use(requireAuth());

  router.post('/:flashcardId', asyncHandler(c.record));
  router.get('/', asyncHandler(c.list));

  return router;
}
