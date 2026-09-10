import type { Request, Response } from 'express';
import { z } from 'zod';
import { GenerationJobModel } from '@prepkit/db';
import {
  CreateKitBatchRequestSchema,
  CreateKitRequestSchema,
  ReorderRequestSchema,
} from '@prepkit/schema';
import { HttpError } from '../../gateway/http-error.js';
import { getWeakSpots } from '../practice/practice.service.js';
import * as kitsService from './kits.service.js';

const QuestionCategoryEnum = z.enum(['technical', 'behavioural', 'system-design', 'company-fit']);

const AddQuestionSchema = z.object({
  category: QuestionCategoryEnum,
  prompt: z.string().min(1),
  answer_outline: z.string().optional(),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  requirement_ids: z.array(z.string()).optional(),
  expectedRevision: z.number().int().optional(),
});

const UpdateQuestionSchema = z.object({
  prompt: z.string().min(1).optional(),
  answer_outline: z.string().optional(),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  requirement_ids: z.array(z.string()).optional(),
  expectedRevision: z.number().int().optional(),
});

const AddFlashcardSchema = z.object({
  front: z.string().min(1),
  back: z.string().min(1),
  requirement_ids: z.array(z.string()).optional(),
});

const UpdateFlashcardSchema = z.object({
  front: z.string().min(1).optional(),
  back: z.string().min(1).optional(),
  requirement_ids: z.array(z.string()).optional(),
});

/** Controller layer: parses/validates HTTP input and shapes the response envelope; all domain logic lives in kits.service (Model/service layer). */
export const kitsController = {
  async create(req: Request, res: Response) {
    const input = CreateKitRequestSchema.parse(req.body);
    const result = await kitsService.createKit(req.userId!, input);
    res
      .status(result.duplicate ? 200 : 201)
      .json({ success: true, data: result, requestId: req.requestId });
  },

  async createBatch(req: Request, res: Response) {
    const { cases } = CreateKitBatchRequestSchema.parse(req.body);
    const results = await kitsService.createKitsBatch(req.userId!, cases);
    res.status(201).json({ success: true, data: { results }, requestId: req.requestId });
  },

  async list(req: Request, res: Response) {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const [list, stats] = await Promise.all([
      kitsService.listKitsForUser(req.userId!, page, limit),
      kitsService.getDashboardStats(req.userId!),
    ]);
    res.json({ success: true, data: { ...list, stats, page, limit }, requestId: req.requestId });
  },

  async get(req: Request, res: Response) {
    const kit = await kitsService.ownedKitOrThrow(req.userId!, req.params.kitId!);
    res.json({ success: true, data: kit, requestId: req.requestId });
  },

  async remove(req: Request, res: Response) {
    const kit = await kitsService.ownedKitOrThrow(req.userId!, req.params.kitId!);
    await kit.deleteOne();
    res.json({ success: true, data: { deleted: true }, requestId: req.requestId });
  },

  async generate(req: Request, res: Response) {
    await kitsService.ownedKitOrThrow(req.userId!, req.params.kitId!);
    await kitsService.enqueueGeneration(req.params.kitId!, req.userId!);
    res.status(202).json({ success: true, data: { queued: true }, requestId: req.requestId });
  },

  async generationStatus(req: Request, res: Response) {
    await kitsService.ownedKitOrThrow(req.userId!, req.params.kitId!);
    const job = await GenerationJobModel.findOne({ kitId: req.params.kitId })
      .sort({ createdAt: -1 })
      .lean();
    if (!job) throw HttpError.notFound('No generation job found for this kit');
    res.json({ success: true, data: job, requestId: req.requestId });
  },

  async regenerateCompanyBrief(req: Request, res: Response) {
    const kit = await kitsService.regenerateCompanyBrief(req.userId!, req.params.kitId!);
    res.json({ success: true, data: kit, requestId: req.requestId });
  },

  async regenerateQuestionCategory(req: Request, res: Response) {
    const category = QuestionCategoryEnum.parse(req.params.category);
    const kit = await kitsService.regenerateQuestionCategory(
      req.userId!,
      req.params.kitId!,
      category,
    );
    res.json({ success: true, data: kit, requestId: req.requestId });
  },

  async regenerateSchedule(req: Request, res: Response) {
    const days = req.body?.days ? z.number().int().min(1).max(60).parse(req.body.days) : undefined;
    const kit = await kitsService.regenerateSchedule(req.userId!, req.params.kitId!, days);
    res.json({ success: true, data: kit, requestId: req.requestId });
  },

  async addQuestion(req: Request, res: Response) {
    const input = AddQuestionSchema.parse(req.body);
    const kit = await kitsService.addQuestion(
      req.userId!,
      req.params.kitId!,
      input,
      input.expectedRevision,
    );
    res.status(201).json({ success: true, data: kit, requestId: req.requestId });
  },

  async updateQuestion(req: Request, res: Response) {
    const input = UpdateQuestionSchema.parse(req.body);
    const kit = await kitsService.updateQuestion(
      req.userId!,
      req.params.kitId!,
      req.params.questionId!,
      input,
      input.expectedRevision,
    );
    res.json({ success: true, data: kit, requestId: req.requestId });
  },

  async deleteQuestion(req: Request, res: Response) {
    const kit = await kitsService.deleteQuestion(
      req.userId!,
      req.params.kitId!,
      req.params.questionId!,
    );
    res.json({ success: true, data: kit, requestId: req.requestId });
  },

  async pinQuestion(req: Request, res: Response) {
    const isPinned = z.boolean().parse(req.body?.isPinned);
    const kit = await kitsService.setQuestionPinned(
      req.userId!,
      req.params.kitId!,
      req.params.questionId!,
      isPinned,
    );
    res.json({ success: true, data: kit, requestId: req.requestId });
  },

  async moveQuestionCategory(req: Request, res: Response) {
    const category = QuestionCategoryEnum.parse(req.body?.category);
    const kit = await kitsService.moveQuestionCategory(
      req.userId!,
      req.params.kitId!,
      req.params.questionId!,
      category,
    );
    res.json({ success: true, data: kit, requestId: req.requestId });
  },

  async reorderQuestions(req: Request, res: Response) {
    const input = ReorderRequestSchema.parse(req.body);
    const kit = await kitsService.reorderQuestions(
      req.userId!,
      req.params.kitId!,
      input.category,
      input.question_ids,
    );
    res.json({ success: true, data: kit, requestId: req.requestId });
  },

  async addFlashcard(req: Request, res: Response) {
    const input = AddFlashcardSchema.parse(req.body);
    const kit = await kitsService.addFlashcard(req.userId!, req.params.kitId!, input);
    res.status(201).json({ success: true, data: kit, requestId: req.requestId });
  },

  async updateFlashcard(req: Request, res: Response) {
    const input = UpdateFlashcardSchema.parse(req.body);
    const kit = await kitsService.updateFlashcard(
      req.userId!,
      req.params.kitId!,
      req.params.flashcardId!,
      input,
    );
    res.json({ success: true, data: kit, requestId: req.requestId });
  },

  async deleteFlashcard(req: Request, res: Response) {
    const kit = await kitsService.deleteFlashcard(
      req.userId!,
      req.params.kitId!,
      req.params.flashcardId!,
    );
    res.json({ success: true, data: kit, requestId: req.requestId });
  },

  async coverage(req: Request, res: Response) {
    const kit = await kitsService.ownedKitOrThrow(req.userId!, req.params.kitId!);
    res.json({ success: true, data: kit.kit.coverage, requestId: req.requestId });
  },

  async statistics(req: Request, res: Response) {
    const kit = await kitsService.ownedKitOrThrow(req.userId!, req.params.kitId!);
    const active = kit.kit.questions.filter((q) => !q.deleted);
    res.json({
      success: true,
      data: {
        totalQuestions: active.length,
        byCategory: Object.fromEntries(
          (['technical', 'behavioural', 'system-design', 'company-fit'] as const).map((c) => [
            c,
            active.filter((q) => q.category === c).length,
          ]),
        ),
        totalFlashcards: kit.kit.flashcards.filter((f) => !f.deleted).length,
        coverage: kit.kit.coverage,
      },
      requestId: req.requestId,
    });
  },

  async weakSpots(req: Request, res: Response) {
    const kit = await kitsService.ownedKitOrThrow(req.userId!, req.params.kitId!);
    const weakSpots = await getWeakSpots(req.userId!, req.params.kitId!, kit.kit);
    res.json({ success: true, data: weakSpots, requestId: req.requestId });
  },
};
