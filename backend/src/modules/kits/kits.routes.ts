import { Router } from 'express';
import { requireAuth } from '../../gateway/auth-middleware.js';
import { asyncHandler } from '../../gateway/async-handler.js';
import { kitsController as c } from './kits.controller.js';

/** Routes: URL -> Controller wiring only - no business logic here. */
export function kitsRouter(): Router {
  const router = Router();
  router.use(requireAuth());

  router.post('/', asyncHandler(c.create));
  router.post('/batch', asyncHandler(c.createBatch));
  router.get('/', asyncHandler(c.list));
  router.get('/:kitId', asyncHandler(c.get));
  router.delete('/:kitId', asyncHandler(c.remove));

  router.post('/:kitId/generate', asyncHandler(c.generate));
  router.get('/:kitId/generation-status', asyncHandler(c.generationStatus));

  router.post('/:kitId/regenerate/company-brief', asyncHandler(c.regenerateCompanyBrief));
  router.post('/:kitId/regenerate/questions/:category', asyncHandler(c.regenerateQuestionCategory));
  router.post('/:kitId/regenerate/schedule', asyncHandler(c.regenerateSchedule));

  router.post('/:kitId/questions', asyncHandler(c.addQuestion));
  router.patch('/:kitId/questions/:questionId', asyncHandler(c.updateQuestion));
  router.delete('/:kitId/questions/:questionId', asyncHandler(c.deleteQuestion));
  router.post('/:kitId/questions/:questionId/pin', asyncHandler(c.pinQuestion));
  router.post('/:kitId/questions/:questionId/move-category', asyncHandler(c.moveQuestionCategory));
  router.post('/:kitId/questions/reorder', asyncHandler(c.reorderQuestions));

  router.post('/:kitId/flashcards', asyncHandler(c.addFlashcard));
  router.patch('/:kitId/flashcards/:flashcardId', asyncHandler(c.updateFlashcard));
  router.delete('/:kitId/flashcards/:flashcardId', asyncHandler(c.deleteFlashcard));

  router.get('/:kitId/coverage', asyncHandler(c.coverage));
  router.get('/:kitId/statistics', asyncHandler(c.statistics));
  router.get('/:kitId/weak-spots', asyncHandler(c.weakSpots));

  return router;
}
