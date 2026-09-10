import { Types } from 'mongoose';
import { PracticeProgressModel } from '@prepkit/db';
import type { ConfidenceLevel, Kit } from '@prepkit/schema';

const CONFIDENCE_RANK: Record<ConfidenceLevel, number> = { low: 0, medium: 1, high: 2 };

export async function recordPractice(
  userId: string,
  kitId: string,
  flashcardId: string,
  confidence: ConfidenceLevel,
) {
  const existing = await PracticeProgressModel.findOne({ userId, kitId, flashcardId });
  const reviewCount = (existing?.reviewCount ?? 0) + 1;
  const updated = await PracticeProgressModel.findOneAndUpdate(
    { userId, kitId, flashcardId },
    { $set: { confidence, reviewCount, covered: true, lastReviewedAt: new Date() } },
    { upsert: true, new: true },
  );
  return updated;
}

export async function getPracticeProgress(userId: string, kitId: string) {
  return PracticeProgressModel.find({ userId, kitId }).lean();
}

/**
 * Weak-spots aggregation (creative feature + practice mode's "order the next
 * session by what they were least confident about"): a real $group/$sort
 * aggregation over practice_progress, then mapped back against the kit's
 * embedded flashcards/requirements/questions in application code (there's no
 * natural $lookup target since a kit is one document, not a joinable table -
 * see README "Aggregation Usage").
 */
export async function getWeakSpots(userId: string, kitId: string, kit: Kit) {
  const rows = await PracticeProgressModel.aggregate([
    { $match: { userId: new Types.ObjectId(userId), kitId: new Types.ObjectId(kitId) } },
    {
      $group: {
        _id: '$flashcardId',
        confidence: { $last: '$confidence' },
        reviewCount: { $sum: 1 },
        lastReviewedAt: { $max: '$lastReviewedAt' },
      },
    },
  ]);

  const rank = (c: ConfidenceLevel) => CONFIDENCE_RANK[c];
  const sorted = [...rows].sort(
    (a, b) => rank(a.confidence) - rank(b.confidence) || a.reviewCount - b.reviewCount,
  );

  const flashcardsById = new Map(kit.flashcards.filter((f) => !f.deleted).map((f) => [f.id, f]));
  const weakFlashcards = sorted
    .filter((r) => flashcardsById.has(r._id))
    .slice(0, 10)
    .map((r) => ({
      ...flashcardsById.get(r._id)!,
      confidence: r.confidence,
      reviewCount: r.reviewCount,
    }));

  const practicedIds = new Set(rows.map((r) => r._id));
  const neverPracticed = kit.flashcards.filter((f) => !f.deleted && !practicedIds.has(f.id));

  const uncoveredIds = new Set(kit.coverage.uncovered_requirement_ids);
  const uncoveredRequirements = kit.role.requirements.filter((r) => uncoveredIds.has(r.id));

  const activeQuestions = kit.questions.filter((q) => !q.deleted);
  const byCategory = ['technical', 'behavioural', 'system-design', 'company-fit'] as const;
  const weakestCategory = byCategory
    .map((c) => ({ category: c, count: activeQuestions.filter((q) => q.category === c).length }))
    .sort((a, b) => a.count - b.count)[0];

  return {
    uncoveredRequirements,
    weakFlashcards,
    neverPracticedFlashcards: neverPracticed.slice(0, 10),
    recommendedFocusCategory: weakestCategory?.category ?? null,
  };
}
