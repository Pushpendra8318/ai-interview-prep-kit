import type { Request, Response } from 'express';
import { PracticeRequestSchema } from '@prepkit/schema';
import * as kitsService from '../kits/kits.service.js';
import * as practiceService from './practice.service.js';

export const practiceController = {
  async record(req: Request, res: Response) {
    const { confidence } = PracticeRequestSchema.parse(req.body);
    await kitsService.ownedKitOrThrow(req.userId!, req.params.kitId!);
    const progress = await practiceService.recordPractice(
      req.userId!,
      req.params.kitId!,
      req.params.flashcardId!,
      confidence,
    );
    res.json({ success: true, data: progress, requestId: req.requestId });
  },

  async list(req: Request, res: Response) {
    await kitsService.ownedKitOrThrow(req.userId!, req.params.kitId!);
    const progress = await practiceService.getPracticeProgress(req.userId!, req.params.kitId!);
    res.json({ success: true, data: progress, requestId: req.requestId });
  },
};
