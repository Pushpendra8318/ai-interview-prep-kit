import { z } from 'zod';

/** The 14 named generation stages shown verbatim on the frontend's progress screen. */
export const PIPELINE_STAGES = [
  'validating_input',
  'researching_company',
  'finding_relevant_pages',
  'finding_hiring_process',
  'searching_public_discussion',
  'extracting_requirements',
  'generating_company_brief',
  'generating_role_breakdown',
  'generating_questions',
  'generating_flashcards',
  'checking_coverage',
  'closing_coverage_gaps',
  'building_schedule',
  'validating_kit',
] as const;
export const PipelineStageSchema = z.enum(PIPELINE_STAGES);
export type PipelineStage = z.infer<typeof PipelineStageSchema>;

export const STAGE_LABELS: Record<PipelineStage, string> = {
  validating_input: 'Validating Input',
  researching_company: 'Researching Company',
  finding_relevant_pages: 'Finding Relevant Pages',
  finding_hiring_process: 'Finding Hiring Process',
  searching_public_discussion: 'Searching Public Discussion',
  extracting_requirements: 'Extracting Requirements',
  generating_company_brief: 'Generating Company Brief',
  generating_role_breakdown: 'Generating Role Breakdown',
  generating_questions: 'Generating Questions',
  generating_flashcards: 'Generating Flashcards',
  checking_coverage: 'Checking Coverage',
  closing_coverage_gaps: 'Closing Coverage Gaps',
  building_schedule: 'Building Schedule',
  validating_kit: 'Validating Kit',
};

export const StageStatus = ['pending', 'running', 'completed', 'failed', 'skipped'] as const;
export const StageStatusSchema = z.enum(StageStatus);
export type StageStatusT = z.infer<typeof StageStatusSchema>;

export const JobStatus = ['queued', 'running', 'succeeded', 'failed'] as const;
export const JobStatusSchema = z.enum(JobStatus);
export type JobStatusT = z.infer<typeof JobStatusSchema>;
