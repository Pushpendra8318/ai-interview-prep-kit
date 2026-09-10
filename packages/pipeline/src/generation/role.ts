import { buildPrompt } from '../llm/prompt.js';
import { generateValidated } from '../llm/json-repair.js';
import type { LLMProvider } from '../llm/types.js';
import { DraftRoleSchema } from './schemas.js';

const SYSTEM = `You summarize a job posting's role for a candidate. Only use what the posting states; do not invent responsibilities or seniority not implied by the text.`;

const TASK = `Read the job description below and respond with JSON only:
{"title": string, "seniority": string (e.g. "Junior", "Mid", "Senior", "Staff" - your best inference from the text), "responsibilities": string[] (short bullet-style items, only what's actually described)}`;

/** Stage 3: role breakdown - title/seniority/responsibilities, its own call and instructions. */
export async function generateRoleBreakdown(
  jd: string,
  provider: LLMProvider,
): Promise<{ title: string; seniority: string; responsibilities: string[] }> {
  return generateValidated(
    provider,
    (repairNote) =>
      buildPrompt({
        system: repairNote ? `${SYSTEM}\n\n${repairNote}` : SYSTEM,
        task: TASK,
        untrustedContent: jd,
      }),
    DraftRoleSchema,
  );
}
