import type { CompanyBrief } from '@prepkit/schema';
import { buildPrompt } from '../llm/prompt.js';
import { generateValidated } from '../llm/json-repair.js';
import type { LLMProvider } from '../llm/types.js';
import { DraftCompanyBriefSchema } from './schemas.js';
import type { CrawledPage } from '../research/crawler.js';

const SYSTEM = `You write short, factual company briefs for a candidate preparing for an interview.
Rules:
- Only state facts that are directly supported by the source material provided below.
- Never invent products, funding rounds, headcount, or claims that aren't in the text.
- If the source material is thin, write a short, honest brief that says what's known and doesn't pad with speculation.`;

const TASK = `Using the company website excerpts below, write a company brief. Respond with JSON only:
{"summary": string (2-4 sentences), "what_they_do": string (1-2 sentences on their product/service)}`;

/**
 * Stage 2: company brief - built only from what research actually retrieved.
 * If nothing was retrieved, this returns an honest empty brief without
 * spending an LLM call (brief §10: "a company you can find nothing about
 * should produce an honest brief rather than a fabricated one").
 */
export async function generateCompanyBrief(
  company: string,
  pages: CrawledPage[],
  provider: LLMProvider,
): Promise<CompanyBrief> {
  if (pages.length === 0) {
    return {
      summary: `We could not retrieve any information about ${company || 'this company'} from their website. This brief is intentionally left thin rather than guessed.`,
      what_they_do: '',
      sources: [],
    };
  }

  const combined = pages
    .map(
      (p) =>
        `--- ${p.sourceType.toUpperCase()} PAGE (${p.url}) ---\n${p.title}\n${p.text.slice(0, 2500)}`,
    )
    .join('\n\n');

  const draft = await generateValidated(
    provider,
    (repairNote) =>
      buildPrompt({
        system: repairNote ? `${SYSTEM}\n\n${repairNote}` : SYSTEM,
        task: `${TASK}\n\nCompany name: ${company}`,
        untrustedContent: combined,
      }),
    DraftCompanyBriefSchema,
  );

  return {
    summary: draft.summary,
    what_they_do: draft.what_they_do,
    sources: pages.map((p) => p.url),
  };
}
