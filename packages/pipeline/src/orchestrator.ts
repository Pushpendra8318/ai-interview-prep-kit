import {
  KitSchema,
  validateKitInvariants,
  type Kit,
  type PipelineStage,
  type StageStatusT,
} from '@prepkit/schema';
import type { LLMProvider } from './llm/types.js';
import { LLMUnavailableError } from './llm/types.js';
import { crawlCompanySite, type CrawledPage, type SourceRecord } from './research/crawler.js';
import { searchPublicDiscussion } from './research/search.js';
import { extractRequirements } from './generation/requirements.js';
import { generateCompanyBrief } from './generation/brief.js';
import { generateRoleBreakdown } from './generation/role.js';
import { generateAllQuestions } from './generation/questions.js';
import { generateFlashcards } from './generation/flashcards.js';
import { generateGapQuestions, synthesizeFallbackQuestions } from './generation/gap-repair.js';
import { calculateCoverage } from './coverage.js';
import { allocateSchedule } from './schedule.js';
import { IdSequence, type IdCounters } from './id-sequence.js';
import { PipelineError } from './errors.js';

export interface PipelineInput {
  jd: string;
  companyUrl: string;
  days: number;
}

export type StageReporter = (
  stage: PipelineStage,
  status: StageStatusT,
  error?: string,
) => void | Promise<void>;

export interface PipelineDeps {
  provider: LLMProvider;
  maxCrawlPages: number;
  crawlTimeoutMs: number;
  maxResponseBytes: number;
  searchApiKey?: string;
  coverageMaxPasses: number;
  allowLoopback: boolean;
  onStage?: StageReporter;
}

export interface PipelineResult {
  kit: Kit;
  sourceRecords: SourceRecord[];
  nextIdSeq: IdCounters;
}

export function titleCase(slug: string): string {
  return slug
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * The company's own domain is a far more reliable anchor than the homepage
 * `<title>` - title *order* varies a lot between sites ("Brand | Tagline" vs
 * "Tagline | Brand", seen live: atlassian.com puts the marketing tagline
 * first and the brand name last), so blindly taking "the first segment"
 * picks the tagline on some sites and the brand on others. Instead: find
 * whichever title segment matches the domain, so we get its properly-cased
 * form ("Atlassian") when available, and fall back to a title-cased domain
 * slug when the title doesn't contain a clean match at all.
 */
export function guessCompanyName(companyUrl: string, pages: CrawledPage[]): string {
  let domainSlug = '';
  try {
    domainSlug = new URL(companyUrl).hostname.replace(/^www\./, '').split('.')[0] ?? '';
  } catch {
    return companyUrl;
  }

  const homepageTitle = pages.find((p) => p.sourceType === 'homepage')?.title;
  if (homepageTitle && domainSlug) {
    const segments = homepageTitle
      .split(/[|\-–—:·•]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const match = segments.find((seg) => seg.toLowerCase().replace(/\s+/g, '') === domainSlug.toLowerCase());
    if (match) return match;
  }

  return domainSlug ? titleCase(domainSlug) : companyUrl;
}

async function runStage<T>(
  deps: PipelineDeps,
  stage: PipelineStage,
  fn: () => Promise<T>,
): Promise<T> {
  await deps.onStage?.(stage, 'running');
  try {
    const result = await fn();
    await deps.onStage?.(stage, 'completed');
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await deps.onStage?.(stage, 'failed', message);
    if (error instanceof PipelineError) throw error;
    if (error instanceof LLMUnavailableError) {
      throw new PipelineError('LLM_UNAVAILABLE', `${stage}: ${message}`);
    }
    throw new PipelineError('GENERATION_FAILED', `${stage}: ${message}`);
  }
}

/**
 * The single pipeline entry point. Used identically by the in-process job
 * runner (backend) and the batch CLI (scripts/evaluate.ts) - same function,
 * not a parallel implementation, per brief §9.
 */
export async function runPipeline(
  input: PipelineInput,
  deps: PipelineDeps,
): Promise<PipelineResult> {
  const ids = new IdSequence();

  await runStage(deps, 'validating_input', async () => {
    if (!input.jd || !input.jd.trim()) {
      throw new PipelineError('INVALID_CASE', 'Job description is empty');
    }
    try {
      new URL(input.companyUrl);
    } catch {
      throw new PipelineError('INVALID_CASE', `Invalid company URL: ${input.companyUrl}`);
    }
    if (!Number.isInteger(input.days) || input.days < 1) {
      throw new PipelineError('INVALID_CASE', `days must be a positive integer, got ${input.days}`);
    }
  });

  const normalizedUrl = new URL(input.companyUrl).toString();

  const crawl = await runStage(deps, 'researching_company', () =>
    crawlCompanySite(normalizedUrl, {
      maxPages: deps.maxCrawlPages,
      timeoutMs: deps.crawlTimeoutMs,
      maxBytes: deps.maxResponseBytes,
      allowLoopback: deps.allowLoopback,
    }),
  );

  await deps.onStage?.('finding_relevant_pages', crawl.pages.length > 1 ? 'completed' : 'skipped');
  const hiringPageFound = crawl.pages.some(
    (p) => p.sourceType === 'careers' || p.sourceType === 'interview-process',
  );
  await deps.onStage?.('finding_hiring_process', hiringPageFound ? 'completed' : 'skipped');

  const companyName = guessCompanyName(normalizedUrl, crawl.pages);

  const publicDiscussion = await runStage(deps, 'searching_public_discussion', () =>
    searchPublicDiscussion(companyName, {
      apiKey: deps.searchApiKey,
      timeoutMs: deps.crawlTimeoutMs,
    }),
  );
  if (publicDiscussion.length === 0) {
    await deps.onStage?.('searching_public_discussion', 'skipped');
  }

  const requirements = await runStage(deps, 'extracting_requirements', () =>
    extractRequirements(input.jd, deps.provider, ids),
  );

  const companyBrief = await runStage(deps, 'generating_company_brief', async () => {
    const brief = await generateCompanyBrief(companyName, crawl.pages, deps.provider);
    if (publicDiscussion.length > 0) {
      brief.sources = [...brief.sources, ...publicDiscussion.map((d) => d.url)];
    }
    return brief;
  });

  const roleDraft = await runStage(deps, 'generating_role_breakdown', () =>
    generateRoleBreakdown(input.jd, deps.provider),
  );

  let questions = await runStage(deps, 'generating_questions', () =>
    generateAllQuestions(requirements, companyBrief, roleDraft.title, deps.provider, ids),
  );

  const flashcards = await runStage(deps, 'generating_flashcards', () =>
    generateFlashcards(requirements, deps.provider, ids),
  );

  let coverage = await runStage(deps, 'checking_coverage', async () =>
    calculateCoverage(requirements, questions),
  );

  let passes = 1;
  if (coverage.uncovered_requirement_ids.length === 0) {
    await deps.onStage?.('closing_coverage_gaps', 'skipped');
  } else {
    await runStage(deps, 'closing_coverage_gaps', async () => {
      for (; passes <= deps.coverageMaxPasses; passes++) {
        const uncoveredReqs = requirements.filter((r) =>
          coverage.uncovered_requirement_ids.includes(r.id),
        );
        if (uncoveredReqs.length === 0) break;
        const gapQuestions = await generateGapQuestions(uncoveredReqs, deps.provider, ids);
        questions = [...questions, ...gapQuestions];
        coverage = calculateCoverage(requirements, questions);
        if (coverage.uncovered_requirement_ids.length === 0) break;
      }
      if (coverage.uncovered_requirement_ids.length > 0) {
        const stillUncovered = requirements.filter((r) =>
          coverage.uncovered_requirement_ids.includes(r.id),
        );
        questions = [...questions, ...synthesizeFallbackQuestions(stillUncovered, ids)];
        coverage = calculateCoverage(requirements, questions);
      }
    });
  }
  coverage.passes = passes;

  const schedule = await runStage(deps, 'building_schedule', async () =>
    allocateSchedule(requirements, questions, input.days),
  );

  const kit: Kit = await runStage(deps, 'validating_kit', async () => {
    const candidate: Kit = {
      source: {
        company: companyName,
        company_url: normalizedUrl,
        role: roleDraft.title,
        location: '',
        jd_chars: input.jd.length,
        researched_at: new Date().toISOString(),
        pages_used: crawl.pages.map((p) => p.url),
      },
      company_brief: companyBrief,
      role: {
        title: roleDraft.title,
        seniority: roleDraft.seniority,
        responsibilities: roleDraft.responsibilities,
        requirements,
      },
      questions,
      flashcards,
      schedule,
      coverage,
    };

    const parsed = KitSchema.safeParse(candidate);
    if (!parsed.success) {
      throw new Error(`schema validation: ${parsed.error.issues.map((i) => i.message).join('; ')}`);
    }
    const problems = validateKitInvariants(parsed.data);
    if (problems.length > 0) {
      throw new Error(`invariant check: ${problems.join('; ')}`);
    }
    return parsed.data;
  });

  return { kit, sourceRecords: crawl.sourceRecords, nextIdSeq: ids.snapshot() };
}
