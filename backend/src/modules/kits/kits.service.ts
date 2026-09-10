import { Types } from 'mongoose';
import { GenerationJobModel, KitModel, ResearchSourceModel, type KitDoc } from '@prepkit/db';
import {
  IdSequence,
  allocateSchedule,
  computeFingerprint,
  generateCategoryQuestions,
  generateCompanyBrief,
  runPipeline,
} from '@prepkit/pipeline';
import type { Kit, QuestionCategory } from '@prepkit/schema';
import { PIPELINE_STAGES } from '@prepkit/schema';
import { rootLogger } from '@prepkit/logger';
import { HttpError } from '../../gateway/http-error.js';
import { getEnv, getProvider } from '../../context.js';
import * as mutations from './kit-mutations.js';

function buildEmptyKit(input: { company_url: string; jd: string; days: number }): Kit {
  return {
    source: {
      company: '',
      company_url: input.company_url,
      role: '',
      location: '',
      jd_chars: input.jd.length,
      researched_at: '',
      pages_used: [],
    },
    company_brief: { summary: '', what_they_do: '', sources: [] },
    role: { title: '', seniority: '', responsibilities: [], requirements: [] },
    questions: [],
    flashcards: [],
    schedule: {
      days_available: input.days,
      days: Array.from({ length: input.days }, (_, i) => ({
        day: i + 1,
        focus: '',
        question_ids: [] as string[],
        minutes: 0,
      })),
    },
    coverage: { uncovered_requirement_ids: [], passes: 0 },
  };
}

export async function ownedKitOrThrow(
  userId: string,
  kitId: string,
): Promise<InstanceType<typeof KitModel>> {
  const kit = await KitModel.findOne({ _id: kitId, userId });
  if (!kit) throw HttpError.notFound('Kit not found');
  return kit;
}

export interface CreateKitInput {
  jd: string;
  company_url: string;
  days: number;
}

export async function createKit(userId: string, input: CreateKitInput) {
  const fingerprint = computeFingerprint(input.jd, input.company_url);
  const existing = await KitModel.findOne({ userId, fingerprint });
  if (existing) {
    return { kitId: existing._id.toString(), duplicate: true, status: existing.status };
  }

  const kitDoc = await KitModel.create({
    userId,
    fingerprint,
    status: 'draft',
    revision: 1,
    jd: input.jd,
    days: input.days,
    nextIdSeq: { requirement: 1, question: 1, flashcard: 1 },
    kit: buildEmptyKit(input),
  });

  await enqueueGeneration(kitDoc._id.toString(), userId);
  return { kitId: kitDoc._id.toString(), duplicate: false, status: 'draft' };
}

/** Batch upload of description-and-company pairs (brief §2): one createKit call per case, all owned by the same user. */
export async function createKitsBatch(userId: string, cases: CreateKitInput[]) {
  const results: { kitId: string; duplicate: boolean; status: string }[] = [];
  for (const input of cases) {
    results.push(await createKit(userId, input));
  }
  return results;
}

export async function enqueueGeneration(kitId: string, userId: string): Promise<void> {
  const existingJob = await GenerationJobModel.findOne({
    kitId,
    status: { $in: ['queued', 'running'] },
  });
  if (existingJob) return; // idempotent - never double-enqueue a kit already in flight
  await GenerationJobModel.create({
    kitId,
    userId,
    status: 'queued',
    currentStage: null,
    stages: PIPELINE_STAGES.map((name) => ({ name, status: 'pending' as const })),
    attempts: 0,
    error: null,
  });
  await KitModel.updateOne({ _id: kitId }, { $set: { status: 'researching' } });
}

export async function listKitsForUser(userId: string, page: number, limit: number) {
  const [{ items, total } = { items: [], total: 0 }] = await KitModel.aggregate([
    { $match: { userId: new Types.ObjectId(userId) } },
    {
      $facet: {
        items: [
          { $sort: { updatedAt: -1 } },
          { $skip: (page - 1) * limit },
          { $limit: limit },
          {
            $project: {
              status: 1,
              updatedAt: 1,
              createdAt: 1,
              'kit.source.company': 1,
              'kit.source.role': 1,
              'kit.coverage': 1,
              questionCount: { $size: { $ifNull: ['$kit.questions', []] } },
              flashcardCount: { $size: { $ifNull: ['$kit.flashcards', []] } },
            },
          },
        ],
        total: [{ $count: 'count' }],
      },
    },
    {
      $project: {
        items: 1,
        total: { $ifNull: [{ $arrayElemAt: ['$total.count', 0] }, 0] },
      },
    },
  ]);
  return { items, total };
}

export async function getDashboardStats(userId: string) {
  const [stats] = await KitModel.aggregate([
    { $match: { userId: new Types.ObjectId(userId) } },
    {
      $facet: {
        totalKits: [{ $count: 'count' }],
        byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
        needsAttention: [
          { $match: { 'kit.coverage.uncovered_requirement_ids.0': { $exists: true } } },
          { $count: 'count' },
        ],
      },
    },
  ]);
  return {
    totalKits: stats?.totalKits?.[0]?.count ?? 0,
    byStatus: Object.fromEntries(
      (stats?.byStatus ?? []).map((s: { _id: string; count: number }) => [s._id, s.count]),
    ),
    needsAttention: stats?.needsAttention?.[0]?.count ?? 0,
  };
}

/**
 * The actual pipeline run for a kit's generation job - called by the
 * in-process job runner. Reports progress into the GenerationJob document so
 * the frontend's polling progress screen reflects real stage state.
 */
export async function runGenerationForKit(kitId: string): Promise<void> {
  const kitDoc = await KitModel.findById(kitId);
  if (!kitDoc) return;
  const job = await GenerationJobModel.findOne({ kitId, status: { $in: ['queued', 'running'] } });
  if (!job) return;

  job.status = 'running';
  job.attempts += 1;
  await job.save();
  await KitModel.updateOne({ _id: kitId }, { $set: { status: 'generating' } });

  const env = getEnv();
  const provider = getProvider();

  try {
    const result = await runPipeline(
      { jd: kitDoc.jd, companyUrl: kitDoc.kit.source.company_url, days: kitDoc.days },
      {
        provider,
        maxCrawlPages: env.MAX_CRAWL_PAGES,
        crawlTimeoutMs: env.CRAWL_TIMEOUT_MS,
        maxResponseBytes: env.MAX_RESPONSE_SIZE,
        searchApiKey: env.SEARCH_API_KEY,
        coverageMaxPasses: env.COVERAGE_MAX_PASSES,
        allowLoopback: env.NODE_ENV !== 'production',
        onStage: async (stage, status, error) => {
          job.currentStage = status === 'completed' || status === 'skipped' ? null : stage;
          const record = job.stages.find((s) => s.name === stage);
          if (record) {
            record.status = status;
            if (status === 'running') record.startedAt = new Date();
            if (status !== 'running') record.finishedAt = new Date();
            if (error) record.error = error;
          }
          await job.save();
        },
      },
    );

    await ResearchSourceModel.insertMany(result.sourceRecords.map((s) => ({ ...s, kitId })));

    kitDoc.kit = result.kit;
    kitDoc.nextIdSeq = result.nextIdSeq;
    kitDoc.status = 'ready';
    kitDoc.revision += 1;
    await kitDoc.save();

    job.status = 'succeeded';
    await job.save();
  } catch (error) {
    rootLogger.error({ err: error, kitId }, 'Generation pipeline failed');
    const code = (error as { code?: string })?.code ?? 'GENERATION_FAILED';
    const message = error instanceof Error ? error.message : String(error);
    job.status = 'failed';
    job.error = { code, message };
    await job.save();
    await KitModel.updateOne({ _id: kitId }, { $set: { status: 'failed' } });
  }
}

function assertRevision(kitDoc: KitDoc & { revision: number }, expectedRevision?: number) {
  if (expectedRevision !== undefined && expectedRevision !== kitDoc.revision) {
    throw HttpError.conflict('This kit changed elsewhere - reload and try again');
  }
}

async function persist(kitDoc: InstanceType<typeof KitModel>, updatedKit: Kit): Promise<void> {
  kitDoc.kit = updatedKit;
  kitDoc.revision += 1;
  kitDoc.markModified('kit');
  await kitDoc.save();
}

export async function addQuestion(
  userId: string,
  kitId: string,
  input: mutations.AddQuestionInput,
  expectedRevision?: number,
) {
  const kitDoc = await ownedKitOrThrow(userId, kitId);
  assertRevision(kitDoc, expectedRevision);
  const ids = new IdSequence(kitDoc.nextIdSeq);
  const updated = mutations.addQuestion(kitDoc.kit, input, () => ids.nextQuestionId());
  kitDoc.nextIdSeq = ids.snapshot();
  await persist(kitDoc, updated);
  return kitDoc;
}

export async function updateQuestion(
  userId: string,
  kitId: string,
  questionId: string,
  patch: mutations.UpdateQuestionInput,
  expectedRevision?: number,
) {
  const kitDoc = await ownedKitOrThrow(userId, kitId);
  assertRevision(kitDoc, expectedRevision);
  const updated = mutations.updateQuestion(kitDoc.kit, questionId, patch);
  await persist(kitDoc, updated);
  return kitDoc;
}

export async function deleteQuestion(
  userId: string,
  kitId: string,
  questionId: string,
  expectedRevision?: number,
) {
  const kitDoc = await ownedKitOrThrow(userId, kitId);
  assertRevision(kitDoc, expectedRevision);
  const updated = mutations.deleteQuestion(kitDoc.kit, questionId);
  await persist(kitDoc, updated);
  return kitDoc;
}

export async function setQuestionPinned(
  userId: string,
  kitId: string,
  questionId: string,
  isPinned: boolean,
) {
  const kitDoc = await ownedKitOrThrow(userId, kitId);
  const updated = mutations.setQuestionPinned(kitDoc.kit, questionId, isPinned);
  await persist(kitDoc, updated);
  return kitDoc;
}

export async function reorderQuestions(
  userId: string,
  kitId: string,
  category: QuestionCategory,
  questionIds: string[],
) {
  const kitDoc = await ownedKitOrThrow(userId, kitId);
  const updated = mutations.reorderQuestions(kitDoc.kit, category, questionIds);
  await persist(kitDoc, updated);
  return kitDoc;
}

export async function moveQuestionCategory(
  userId: string,
  kitId: string,
  questionId: string,
  category: QuestionCategory,
) {
  const kitDoc = await ownedKitOrThrow(userId, kitId);
  const updated = mutations.moveQuestionCategory(kitDoc.kit, questionId, category);
  await persist(kitDoc, updated);
  return kitDoc;
}

export async function addFlashcard(
  userId: string,
  kitId: string,
  input: mutations.AddFlashcardInput,
) {
  const kitDoc = await ownedKitOrThrow(userId, kitId);
  const ids = new IdSequence(kitDoc.nextIdSeq);
  const updated = mutations.addFlashcard(kitDoc.kit, input, () => ids.nextFlashcardId());
  kitDoc.nextIdSeq = ids.snapshot();
  await persist(kitDoc, updated);
  return kitDoc;
}

export async function updateFlashcard(
  userId: string,
  kitId: string,
  flashcardId: string,
  patch: { front?: string; back?: string; requirement_ids?: string[] },
) {
  const kitDoc = await ownedKitOrThrow(userId, kitId);
  const updated = mutations.updateFlashcard(kitDoc.kit, flashcardId, patch);
  await persist(kitDoc, updated);
  return kitDoc;
}

export async function deleteFlashcard(userId: string, kitId: string, flashcardId: string) {
  const kitDoc = await ownedKitOrThrow(userId, kitId);
  const updated = mutations.deleteFlashcard(kitDoc.kit, flashcardId);
  await persist(kitDoc, updated);
  return kitDoc;
}

export async function regenerateCompanyBrief(userId: string, kitId: string) {
  const kitDoc = await ownedKitOrThrow(userId, kitId);
  const provider = getProvider();
  const sources = await ResearchSourceModel.find({ kitId, retrievalStatus: 'ok' }).lean();
  // public-discussion rows are third-party search hits, not pages of the company's own site -
  // the brief is built from what the crawler retrieved, so those are excluded here.
  const pages = sources
    .filter((s) => s.sourceType !== 'public-discussion')
    .map((s) => ({
      url: s.url,
      title: s.title ?? '',
      text: s.extractedText ?? '',
      sourceType: s.sourceType as Exclude<typeof s.sourceType, 'public-discussion'>,
    }));
  const brief = await generateCompanyBrief(kitDoc.kit.source.company, pages, provider);
  const updated: Kit = { ...kitDoc.kit, company_brief: brief };
  await persist(kitDoc, updated);
  return kitDoc;
}

export async function regenerateQuestionCategory(
  userId: string,
  kitId: string,
  category: QuestionCategory,
) {
  const kitDoc = await ownedKitOrThrow(userId, kitId);
  const provider = getProvider();
  const ids = new IdSequence(kitDoc.nextIdSeq);

  const { preserve, otherCategories } = mutations.partitionCategoryForRegeneration(
    kitDoc.kit,
    category,
  );
  const relevantRequirements =
    category === 'technical'
      ? kitDoc.kit.role.requirements.filter((r) => r.kind === 'technical' || r.kind === 'domain')
      : category === 'behavioural'
        ? kitDoc.kit.role.requirements.filter((r) => r.kind === 'behavioural')
        : category === 'system-design'
          ? kitDoc.kit.role.requirements.filter(
              (r) => r.kind !== 'behavioural' && r.priority === 'must',
            )
          : [];

  const fresh = await generateCategoryQuestions(
    category,
    relevantRequirements,
    kitDoc.kit.company_brief,
    kitDoc.kit.role.title,
    provider,
    ids,
  );
  kitDoc.nextIdSeq = ids.snapshot();

  const updated = mutations.applyRegeneratedCategory(
    kitDoc.kit,
    category,
    preserve,
    otherCategories,
    fresh,
  );
  await persist(kitDoc, updated);
  return kitDoc;
}

export async function regenerateSchedule(userId: string, kitId: string, days?: number) {
  const kitDoc = await ownedKitOrThrow(userId, kitId);
  const daysAvailable = days ?? kitDoc.kit.schedule.days_available;
  const schedule = allocateSchedule(
    kitDoc.kit.role.requirements,
    kitDoc.kit.questions,
    daysAvailable,
  );
  const updated: Kit = { ...kitDoc.kit, schedule };
  await persist(kitDoc, updated);
  return kitDoc;
}
