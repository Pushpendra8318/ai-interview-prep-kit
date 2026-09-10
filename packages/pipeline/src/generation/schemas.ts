import { z } from 'zod';
import { QuestionCategory, RequirementKind, RequirementPriority } from '@prepkit/schema';

/** Shapes the LLM is asked to produce - deliberately narrower than the persisted
 *  entities (no ids, no editor-state fields): those are assigned by application code. */

export const DraftRequirementSchema = z.object({
  text: z.string().min(1).max(300),
  kind: RequirementKind,
  priority: RequirementPriority,
});
export const DraftRequirementsSchema = z.object({
  requirements: z.array(DraftRequirementSchema).max(30),
});

export const DraftCompanyBriefSchema = z.object({
  summary: z.string(),
  what_they_do: z.string(),
});

export const DraftRoleSchema = z.object({
  title: z.string(),
  seniority: z.string(),
  responsibilities: z.array(z.string()).max(15),
});

export const DraftQuestionSchema = z.object({
  requirement_ids: z.array(z.string()),
  prompt: z.string().min(1),
  answer_outline: z.string(),
  difficulty: z.number().int().min(1).max(3),
});
export const DraftQuestionsSchema = z.object({
  questions: z.array(DraftQuestionSchema).max(12),
});

export const DraftFlashcardSchema = z.object({
  front: z.string().min(1),
  back: z.string().min(1),
  requirement_ids: z.array(z.string()),
});
export const DraftFlashcardsSchema = z.object({
  flashcards: z.array(DraftFlashcardSchema).max(20),
});

export type DraftQuestion = z.infer<typeof DraftQuestionSchema>;
export type DraftFlashcard = z.infer<typeof DraftFlashcardSchema>;
export { QuestionCategory };
