import type { CompanyBrief, Question, QuestionCategory, Requirement } from '@prepkit/schema';
import { buildPrompt } from '../llm/prompt.js';
import { generateValidated } from '../llm/json-repair.js';
import type { LLMProvider } from '../llm/types.js';
import type { IdSequence } from '../id-sequence.js';
import { DraftQuestionsSchema, type DraftQuestion } from './schemas.js';

interface CategoryConfig {
  category: QuestionCategory;
  system: string;
  task: string;
  requirements: Requirement[];
}

function requirementsBlock(requirements: Requirement[]): string {
  if (requirements.length === 0) return '(no specific listed requirements for this category)';
  return requirements.map((r) => `${r.id}: ${r.text} [${r.priority}]`).join('\n');
}

function toQuestions(
  drafts: DraftQuestion[],
  category: QuestionCategory,
  validRequirementIds: Set<string>,
  ids: IdSequence,
): Question[] {
  return drafts.map((d) => ({
    id: ids.nextQuestionId(),
    // Drop any hallucinated requirement id rather than failing the whole batch - keeps the
    // pipeline robust to a minor model slip without wasting a retry round-trip.
    requirement_ids: d.requirement_ids.filter((rid) => validRequirementIds.has(rid)),
    category,
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
}

function buildCategoryConfigs(
  requirements: Requirement[],
  companyBrief: CompanyBrief,
  roleTitle: string,
): CategoryConfig[] {
  const technicalReqs = requirements.filter((r) => r.kind === 'technical' || r.kind === 'domain');
  const behaviouralReqs = requirements.filter((r) => r.kind === 'behavioural');
  const mustTechnicalReqs = technicalReqs.filter((r) => r.priority === 'must');

  return [
    {
      category: 'technical',
      requirements: technicalReqs,
      system: `You write hands-on technical interview questions that test depth of specific skills. Each question must be answerable by someone who genuinely has the listed requirement, and must cite the requirement id(s) it tests in "requirement_ids". Prefer one focused question per requirement over generic questions.`,
      task: `Generate one interview question per requirement below (skip none if a requirement is listed). Respond with JSON only:\n{"questions": [{"requirement_ids": [string], "prompt": string, "answer_outline": string (2-4 sentence outline of what a strong answer covers), "difficulty": 1|2|3}]}\n\nRequirements:`,
    },
    {
      category: 'behavioural',
      requirements: behaviouralReqs,
      system: `You write behavioural interview questions (STAR-style) that probe soft skills, leadership, communication and collaboration. Each question must cite the requirement id(s) it addresses in "requirement_ids".`,
      task: `Generate one behavioural interview question per requirement below. Respond with JSON only:\n{"questions": [{"requirement_ids": [string], "prompt": string, "answer_outline": string, "difficulty": 1|2|3}]}\n\nRequirements:`,
    },
    {
      category: 'system-design',
      requirements: mustTechnicalReqs,
      system: `You write system-design/architecture interview questions for a technical role. Given the must-have technical requirements below, write questions that assess how a candidate would design, scale, or make trade-offs in a system that relies on that skill - not simple factual recall. Cite the requirement id(s) each question relates to.`,
      task: `Generate up to 3 system-design interview questions grounded in the requirements below (fewer is fine if the requirements don't support system-design framing). Respond with JSON only:\n{"questions": [{"requirement_ids": [string], "prompt": string, "answer_outline": string, "difficulty": 1|2|3}]}\n\nRequirements:`,
    },
    {
      category: 'company-fit',
      requirements: [],
      system: `You write company-fit / culture interview questions based on a company brief and role, not on specific technical requirements. These questions have no requirement to cite, so always return an empty "requirement_ids" array.`,
      task: `Company summary: ${companyBrief.summary || '(no company information available)'}\nRole: ${roleTitle}\n\nGenerate up to 3 company-fit interview questions. Respond with JSON only:\n{"questions": [{"requirement_ids": [], "prompt": string, "answer_outline": string, "difficulty": 1|2|3}]}`,
    },
  ];
}

async function generateForCategory(
  config: CategoryConfig,
  provider: LLMProvider,
  validRequirementIds: Set<string>,
  ids: IdSequence,
): Promise<Question[]> {
  if (config.requirements.length === 0 && config.category !== 'company-fit') {
    return [];
  }
  const draft = await generateValidated(
    provider,
    (repairNote) =>
      buildPrompt({
        system: repairNote ? `${config.system}\n\n${repairNote}` : config.system,
        task: config.task,
        untrustedContent: requirementsBlock(config.requirements),
      }),
    DraftQuestionsSchema,
  );
  return toQuestions(draft.questions, config.category, validRequirementIds, ids);
}

/**
 * Stage 4: question generation. Each category is a *separate* LLM call with
 * its own instructions and its own slice of the requirement pool - a "5+
 * years React" (technical) requirement and a "mentors junior engineers"
 * (behavioural) requirement never share a call, per brief §3.
 */
export async function generateAllQuestions(
  requirements: Requirement[],
  companyBrief: CompanyBrief,
  roleTitle: string,
  provider: LLMProvider,
  ids: IdSequence,
): Promise<Question[]> {
  const validRequirementIds = new Set(requirements.map((r) => r.id));
  const configs = buildCategoryConfigs(requirements, companyBrief, roleTitle);
  const results = await Promise.all(
    configs.map((config) => generateForCategory(config, provider, validRequirementIds, ids)),
  );
  return results.flat();
}

/** Regenerates just one category - used by the builder's per-category "regenerate" action. */
export async function generateCategoryQuestions(
  category: QuestionCategory,
  requirements: Requirement[],
  companyBrief: CompanyBrief,
  roleTitle: string,
  provider: LLMProvider,
  ids: IdSequence,
): Promise<Question[]> {
  const validRequirementIds = new Set(requirements.map((r) => r.id));
  const config = buildCategoryConfigs(requirements, companyBrief, roleTitle).find(
    (c) => c.category === category,
  );
  if (!config) return [];
  return generateForCategory(config, provider, validRequirementIds, ids);
}
