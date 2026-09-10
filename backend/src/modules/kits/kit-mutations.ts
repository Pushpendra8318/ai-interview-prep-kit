import type { Flashcard, Kit, Question, QuestionCategory, Schedule } from '@prepkit/schema';
import { calculateCoverage } from '@prepkit/pipeline';

/**
 * Pure functions implementing the builder's edit/regeneration state rules
 * (README "Kit Edit/Regeneration State Model"): every mutation here is a
 * plain Kit -> Kit transform, kept free of I/O so the rules themselves are
 * unit-testable without a database.
 */

function recomputeCoverage(kit: Kit, questions: Question[]) {
  const c = calculateCoverage(kit.role.requirements, questions);
  return { uncovered_requirement_ids: c.uncovered_requirement_ids, passes: kit.coverage.passes };
}

function nextOrderFor(questions: Question[], category: QuestionCategory): number {
  const maxOrder = questions
    .filter((q) => q.category === category && !q.deleted)
    .reduce((max, q) => Math.max(max, q.order), -1);
  return maxOrder + 1;
}

function pruneDanglingScheduleIds(schedule: Schedule, questions: Question[]): Schedule {
  const validIds = new Set(questions.filter((q) => !q.deleted).map((q) => q.id));
  return {
    ...schedule,
    days: schedule.days.map((d) => ({
      ...d,
      question_ids: d.question_ids.filter((id) => validIds.has(id)),
    })),
  };
}

export interface AddQuestionInput {
  category: QuestionCategory;
  prompt: string;
  answer_outline?: string;
  difficulty: 1 | 2 | 3;
  requirement_ids?: string[];
}

export function addQuestion(kit: Kit, input: AddQuestionInput, nextId: () => string): Kit {
  const validIds = new Set(kit.role.requirements.map((r) => r.id));
  const question: Question = {
    id: nextId(),
    requirement_ids: (input.requirement_ids ?? []).filter((id) => validIds.has(id)),
    category: input.category,
    prompt: input.prompt,
    answer_outline: input.answer_outline ?? '',
    difficulty: input.difficulty,
    origin: 'user',
    isEdited: false,
    isPinned: false,
    deleted: false,
    version: 1,
    order: nextOrderFor(kit.questions, input.category),
  };
  const questions = [...kit.questions, question];
  return { ...kit, questions, coverage: recomputeCoverage(kit, questions) };
}

export interface UpdateQuestionInput {
  prompt?: string;
  answer_outline?: string;
  difficulty?: 1 | 2 | 3;
  requirement_ids?: string[];
}

export function updateQuestion(kit: Kit, questionId: string, patch: UpdateQuestionInput): Kit {
  const validIds = new Set(kit.role.requirements.map((r) => r.id));
  let found = false;
  const questions = kit.questions.map((q) => {
    if (q.id !== questionId || q.deleted) return q;
    found = true;
    return {
      ...q,
      ...patch,
      requirement_ids: patch.requirement_ids
        ? patch.requirement_ids.filter((id) => validIds.has(id))
        : q.requirement_ids,
      isEdited: q.origin === 'generated' ? true : q.isEdited,
      version: q.version + 1,
    };
  });
  if (!found) throw new Error(`Question ${questionId} not found`);
  return { ...kit, questions, coverage: recomputeCoverage(kit, questions) };
}

export function deleteQuestion(kit: Kit, questionId: string): Kit {
  const questions = kit.questions.map((q) => (q.id === questionId ? { ...q, deleted: true } : q));
  const schedule = pruneDanglingScheduleIds(kit.schedule, questions);
  return { ...kit, questions, schedule, coverage: recomputeCoverage(kit, questions) };
}

export function setQuestionPinned(kit: Kit, questionId: string, isPinned: boolean): Kit {
  const questions = kit.questions.map((q) => (q.id === questionId ? { ...q, isPinned } : q));
  return { ...kit, questions };
}

export function reorderQuestions(kit: Kit, category: QuestionCategory, orderedIds: string[]): Kit {
  const orderIndex = new Map(orderedIds.map((id, i) => [id, i]));
  const questions = kit.questions.map((q) => {
    if (q.category !== category || q.deleted) return q;
    const idx = orderIndex.get(q.id);
    return idx === undefined ? q : { ...q, order: idx };
  });
  return { ...kit, questions };
}

export function moveQuestionCategory(
  kit: Kit,
  questionId: string,
  newCategory: QuestionCategory,
): Kit {
  const questions = kit.questions.map((q) => {
    if (q.id !== questionId) return q;
    return {
      ...q,
      category: newCategory,
      order: nextOrderFor(kit.questions, newCategory),
      isEdited: q.origin === 'generated' ? true : q.isEdited,
      version: q.version + 1,
    };
  });
  return { ...kit, questions };
}

export interface AddFlashcardInput {
  front: string;
  back: string;
  requirement_ids?: string[];
}

export function addFlashcard(kit: Kit, input: AddFlashcardInput, nextId: () => string): Kit {
  const validIds = new Set(kit.role.requirements.map((r) => r.id));
  const flashcard: Flashcard = {
    id: nextId(),
    front: input.front,
    back: input.back,
    requirement_ids: (input.requirement_ids ?? []).filter((id) => validIds.has(id)),
    origin: 'user',
    isEdited: false,
    isPinned: false,
    deleted: false,
    version: 1,
    order: kit.flashcards.filter((f) => !f.deleted).length,
  };
  return { ...kit, flashcards: [...kit.flashcards, flashcard] };
}

export function updateFlashcard(
  kit: Kit,
  flashcardId: string,
  patch: { front?: string; back?: string; requirement_ids?: string[] },
): Kit {
  const validIds = new Set(kit.role.requirements.map((r) => r.id));
  let found = false;
  const flashcards = kit.flashcards.map((f) => {
    if (f.id !== flashcardId || f.deleted) return f;
    found = true;
    return {
      ...f,
      ...patch,
      requirement_ids: patch.requirement_ids
        ? patch.requirement_ids.filter((id) => validIds.has(id))
        : f.requirement_ids,
      isEdited: f.origin === 'generated' ? true : f.isEdited,
      version: f.version + 1,
    };
  });
  if (!found) throw new Error(`Flashcard ${flashcardId} not found`);
  return { ...kit, flashcards };
}

export function deleteFlashcard(kit: Kit, flashcardId: string): Kit {
  const flashcards = kit.flashcards.map((f) =>
    f.id === flashcardId ? { ...f, deleted: true } : f,
  );
  return { ...kit, flashcards };
}

/**
 * Splits a category's current questions into what must survive a
 * regeneration (user-created, hand-edited, or pinned - including soft-deleted
 * tombstones so a user's deletion isn't undone) versus what's eligible to be
 * replaced by a fresh generated batch.
 */
export function partitionCategoryForRegeneration(
  kit: Kit,
  category: QuestionCategory,
): { preserve: Question[]; otherCategories: Question[] } {
  const inCategory = kit.questions.filter((q) => q.category === category);
  const otherCategories = kit.questions.filter((q) => q.category !== category);
  const preserve = inCategory.filter(
    (q) => q.origin === 'user' || q.isEdited || q.isPinned || q.deleted,
  );
  return { preserve, otherCategories };
}

export function applyRegeneratedCategory(
  kit: Kit,
  category: QuestionCategory,
  preserved: Question[],
  otherCategories: Question[],
  fresh: Question[],
): Kit {
  const startOrder = preserved.filter((q) => !q.deleted).length;
  const withOrder = fresh.map((q, i) => ({ ...q, order: startOrder + i }));
  const questions = [...otherCategories, ...preserved, ...withOrder];
  const schedule = pruneDanglingScheduleIds(kit.schedule, questions);
  return { ...kit, questions, schedule, coverage: recomputeCoverage(kit, questions) };
}
