import type { Requirement } from '@prepkit/schema';
import { buildPrompt } from '../llm/prompt.js';
import { generateValidated } from '../llm/json-repair.js';
import type { LLMProvider } from '../llm/types.js';
import type { IdSequence } from '../id-sequence.js';
import { DraftRequirementsSchema } from './schemas.js';

const SYSTEM = `You are an expert technical recruiter extracting structured requirements from a job description.
Rules:
- Only extract requirements that are actually stated in the text. Never invent, assume, or infer a requirement that isn't there.
- If the description is thin (very short, vague, or missing detail), return few requirements - or none - rather than padding the list.
- Classify "priority" as "must" only when the text uses required/mandatory/must-have language (e.g. "Required:", "You must have", "X+ years of Y"). Use "nice" for anything phrased as a bonus, preferred, or nice-to-have (e.g. "Bonus points for", "Preferred", "a plus").
- Classify "kind" as "technical" (tools/languages/frameworks/systems), "behavioural" (soft skills, leadership, communication, mentoring), or "domain" (industry/business-specific knowledge, e.g. healthcare compliance, fintech regulations).
- Keep each requirement text short and close to the source wording.`;

const TASK = `Extract the requirements from the job description provided below. Respond with JSON only:
{"requirements": [{"text": string, "kind": "technical"|"behavioural"|"domain", "priority": "must"|"nice"}]}`;

/** Stage 1: requirement extraction. Pasted JD text needs no retrieval - this stage never touches research output. */
export async function extractRequirements(
  jd: string,
  provider: LLMProvider,
  ids: IdSequence,
): Promise<Requirement[]> {
  const draft = await generateValidated(
    provider,
    (repairNote) =>
      buildPrompt({
        system: repairNote ? `${SYSTEM}\n\n${repairNote}` : SYSTEM,
        task: TASK,
        untrustedContent: jd,
      }),
    DraftRequirementsSchema,
  );

  return draft.requirements.map((r) => ({
    id: ids.nextRequirementId(),
    text: r.text,
    kind: r.kind,
    priority: r.priority,
    origin: 'generated' as const,
    deleted: false,
  }));
}
