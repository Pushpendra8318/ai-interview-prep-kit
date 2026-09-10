import type { Flashcard, Requirement } from '@prepkit/schema';
import { buildPrompt } from '../llm/prompt.js';
import { generateValidated } from '../llm/json-repair.js';
import type { LLMProvider } from '../llm/types.js';
import type { IdSequence } from '../id-sequence.js';
import { DraftFlashcardsSchema } from './schemas.js';

const SYSTEM = `You write concise flashcards (front/back) for interview prep, one concept per card. The back should be a short, memorable answer - a few sentences at most, not an essay. Cite the requirement id(s) each card reinforces.`;

const TASK = `Generate one flashcard per must-have requirement below (nice-to-have requirements are optional, include a couple if useful). Respond with JSON only:
{"flashcards": [{"front": string, "back": string, "requirement_ids": [string]}]}

Requirements:`;

/** Stage 5: flashcards, derived from the requirement set (own call, own instructions). */
export async function generateFlashcards(
  requirements: Requirement[],
  provider: LLMProvider,
  ids: IdSequence,
): Promise<Flashcard[]> {
  if (requirements.length === 0) return [];

  const validIds = new Set(requirements.map((r) => r.id));
  const block = requirements.map((r) => `${r.id}: ${r.text} [${r.priority}]`).join('\n');

  const draft = await generateValidated(
    provider,
    (repairNote) =>
      buildPrompt({
        system: repairNote ? `${SYSTEM}\n\n${repairNote}` : SYSTEM,
        task: TASK,
        untrustedContent: block,
      }),
    DraftFlashcardsSchema,
  );

  return draft.flashcards.map((f) => ({
    id: ids.nextFlashcardId(),
    front: f.front,
    back: f.back,
    requirement_ids: f.requirement_ids.filter((rid) => validIds.has(rid)),
    origin: 'generated' as const,
    isEdited: false,
    isPinned: false,
    deleted: false,
    version: 1,
    order: 0,
  }));
}
