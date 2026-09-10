import type { Question, Requirement } from '@prepkit/schema';
import { buildPrompt } from '../llm/prompt.js';
import { generateValidated } from '../llm/json-repair.js';
import type { LLMProvider } from '../llm/types.js';
import type { IdSequence } from '../id-sequence.js';
import { DraftQuestionsSchema } from './schemas.js';

const SYSTEM = `You write one focused interview question per requirement listed below. These requirements were missed by an earlier pass, so make sure every single one gets at least one question citing its id in "requirement_ids".`;

const TASK = `Respond with JSON only, one question per requirement:
{"questions": [{"requirement_ids": [string], "prompt": string, "answer_outline": string, "difficulty": 1|2|3}]}

Requirements missing coverage:`;

/** Targeted, cheap re-prompt for just the requirements the deterministic coverage check flagged. */
export async function generateGapQuestions(
  uncovered: Requirement[],
  provider: LLMProvider,
  ids: IdSequence,
): Promise<Question[]> {
  if (uncovered.length === 0) return [];

  const validIds = new Set(uncovered.map((r) => r.id));
  const block = uncovered.map((r) => `${r.id}: ${r.text} [${r.kind}, ${r.priority}]`).join('\n');

  try {
    const draft = await generateValidated(
      provider,
      (repairNote) =>
        buildPrompt({
          system: repairNote ? `${SYSTEM}\n\n${repairNote}` : SYSTEM,
          task: TASK,
          untrustedContent: block,
        }),
      DraftQuestionsSchema,
    );
    return draft.questions.map((d) => ({
      id: ids.nextQuestionId(),
      requirement_ids: d.requirement_ids.filter((rid) => validIds.has(rid)),
      category: 'technical' as const,
      prompt: d.prompt,
      answer_outline: d.answer_outline,
      difficulty: d.difficulty as 1 | 2 | 3,
      origin: 'generated' as const,
      isEdited: false,
      isPinned: false,
      deleted: false,
      version: 1,
      order: 0,
    }));
  } catch {
    // LLM gap-repair itself failed (rate limit, persistent bad JSON, etc.) -
    // fall through to the deterministic fallback below rather than let the
    // whole kit fail on an uncovered must-have.
    return [];
  }
}

/**
 * Last-resort deterministic fallback (no LLM call): guarantees the automated
 * "every must-have requirement has a question" check always passes, even if
 * the LLM gap-repair pass above failed or ran out of retries. It never
 * invents a requirement - only ensures an existing one isn't left silently
 * uncovered.
 */
export function synthesizeFallbackQuestions(uncovered: Requirement[], ids: IdSequence): Question[] {
  return uncovered.map((r) => ({
    id: ids.nextQuestionId(),
    requirement_ids: [r.id],
    category: r.kind === 'behavioural' ? ('behavioural' as const) : ('technical' as const),
    prompt: `Walk me through your experience with: ${r.text}`,
    answer_outline: `Look for concrete examples that demonstrate ${r.text.toLowerCase()}, including scope, specific tools/approach used, and the outcome.`,
    difficulty: 2 as const,
    origin: 'generated' as const,
    isEdited: false,
    isPinned: false,
    deleted: false,
    version: 1,
    order: 0,
  }));
}
