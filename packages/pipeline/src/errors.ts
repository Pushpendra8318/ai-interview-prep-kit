export type PipelineErrorCode =
  'INVALID_CASE' | 'COMPANY_UNREACHABLE' | 'LLM_UNAVAILABLE' | 'GENERATION_FAILED';

/** Thrown only when a case truly cannot produce a usable kit at all - never for a merely thin/partial one. */
export class PipelineError extends Error {
  readonly code: PipelineErrorCode;

  constructor(code: PipelineErrorCode, message: string) {
    super(message);
    this.name = 'PipelineError';
    this.code = code;
  }
}
