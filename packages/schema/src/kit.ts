import { z } from 'zod';

/**
 * Appendix A of the assessment brief is the contract: field names and shapes
 * below must match exactly. Extension/state-tracking fields (origin,
 * isEdited, isPinned, deleted, version, order) are additive siblings used to
 * implement the builder's edit/regeneration rules (README section
 * "Edit/Regeneration State") - they never replace or rename a mandated field.
 */

export const RequirementKind = z.enum(['technical', 'behavioural', 'domain']);
export type RequirementKind = z.infer<typeof RequirementKind>;

export const RequirementPriority = z.enum(['must', 'nice']);
export type RequirementPriority = z.infer<typeof RequirementPriority>;

export const QuestionCategory = z.enum([
  'technical',
  'behavioural',
  'system-design',
  'company-fit',
]);
export type QuestionCategory = z.infer<typeof QuestionCategory>;

export const Origin = z.enum(['generated', 'user']);
export type Origin = z.infer<typeof Origin>;

/** Shared edit-tracking fields, additive to every builder-editable entity. */
const editableMeta = {
  origin: Origin.default('generated'),
  isEdited: z.boolean().default(false),
  isPinned: z.boolean().default(false),
  deleted: z.boolean().default(false),
  version: z.number().int().min(1).default(1),
  order: z.number().int().min(0).default(0),
};

export const RequirementSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  kind: RequirementKind,
  priority: RequirementPriority,
  origin: Origin.default('generated'),
  deleted: z.boolean().default(false),
});
export type Requirement = z.infer<typeof RequirementSchema>;

export const QuestionSchema = z.object({
  id: z.string().min(1),
  requirement_ids: z.array(z.string().min(1)),
  category: QuestionCategory,
  prompt: z.string().min(1),
  answer_outline: z.string(),
  difficulty: z.number().int().min(1).max(3),
  ...editableMeta,
});
export type Question = z.infer<typeof QuestionSchema>;

export const FlashcardSchema = z.object({
  id: z.string().min(1),
  front: z.string().min(1),
  back: z.string().min(1),
  requirement_ids: z.array(z.string().min(1)),
  ...editableMeta,
});
export type Flashcard = z.infer<typeof FlashcardSchema>;

export const ScheduleDaySchema = z.object({
  day: z.number().int().min(1),
  focus: z.string(),
  question_ids: z.array(z.string().min(1)),
  minutes: z.number().int().min(0),
});
export type ScheduleDay = z.infer<typeof ScheduleDaySchema>;

export const ScheduleSchema = z.object({
  days_available: z.number().int().min(1),
  days: z.array(ScheduleDaySchema),
});
export type Schedule = z.infer<typeof ScheduleSchema>;

export const CoverageSchema = z.object({
  uncovered_requirement_ids: z.array(z.string()),
  passes: z.number().int().min(0),
});
export type Coverage = z.infer<typeof CoverageSchema>;

export const SourceSchema = z.object({
  company: z.string(),
  company_url: z.string(),
  role: z.string(),
  location: z.string(),
  jd_chars: z.number().int().min(0),
  researched_at: z.string(),
  pages_used: z.array(z.string()),
});
export type Source = z.infer<typeof SourceSchema>;

export const CompanyBriefSchema = z.object({
  summary: z.string(),
  what_they_do: z.string(),
  sources: z.array(z.string()),
});
export type CompanyBrief = z.infer<typeof CompanyBriefSchema>;

export const RoleSchema = z.object({
  title: z.string(),
  seniority: z.string(),
  responsibilities: z.array(z.string()),
  requirements: z.array(RequirementSchema),
});
export type Role = z.infer<typeof RoleSchema>;

export const KitSchema = z.object({
  source: SourceSchema,
  company_brief: CompanyBriefSchema,
  role: RoleSchema,
  questions: z.array(QuestionSchema),
  flashcards: z.array(FlashcardSchema),
  schedule: ScheduleSchema,
  coverage: CoverageSchema,
});
export type Kit = z.infer<typeof KitSchema>;

/** Structural invariants Zod's shape validation alone can't express. */
export function validateKitInvariants(kit: Kit): string[] {
  const problems: string[] = [];

  const requirementIds = new Set(kit.role.requirements.map((r) => r.id));
  const questionIds = new Set(kit.questions.map((q) => q.id));

  for (const q of kit.questions) {
    for (const rid of q.requirement_ids) {
      if (!requirementIds.has(rid)) {
        problems.push(`question ${q.id} references unknown requirement ${rid}`);
      }
    }
  }

  for (const f of kit.flashcards) {
    for (const rid of f.requirement_ids) {
      if (!requirementIds.has(rid)) {
        problems.push(`flashcard ${f.id} references unknown requirement ${rid}`);
      }
    }
  }

  if (kit.schedule.days.length !== kit.schedule.days_available) {
    problems.push(
      `schedule has ${kit.schedule.days.length} days but days_available is ${kit.schedule.days_available}`,
    );
  }

  for (const day of kit.schedule.days) {
    for (const qid of day.question_ids) {
      if (!questionIds.has(qid)) {
        problems.push(`schedule day ${day.day} references unknown question ${qid}`);
      }
    }
  }

  const mustIds = kit.role.requirements
    .filter((r) => r.priority === 'must' && !r.deleted)
    .map((r) => r.id);
  const uncoveredSet = new Set(kit.coverage.uncovered_requirement_ids);
  for (const id of mustIds) {
    if (uncoveredSet.has(id)) {
      problems.push(`must-have requirement ${id} is still uncovered`);
    }
  }

  return problems;
}
