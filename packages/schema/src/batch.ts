import { z } from 'zod';
import { KitSchema } from './kit.js';

/** Appendix B: input case shape for `npm run evaluate`. */
export const BatchCaseSchema = z.object({
  id: z.string().min(1),
  jd: z.string(),
  company_url: z.string(),
  days: z.number().int().min(1),
});
export type BatchCase = z.infer<typeof BatchCaseSchema>;

export const BatchInputSchema = z.array(BatchCaseSchema);

export const BatchErrorCode = z.enum([
  'INVALID_CASE',
  'COMPANY_UNREACHABLE',
  'LLM_UNAVAILABLE',
  'GENERATION_FAILED',
  'UNKNOWN',
]);
export type BatchErrorCode = z.infer<typeof BatchErrorCode>;

export const BatchKitResultSchema = z.discriminatedUnion('status', [
  z.object({
    id: z.string(),
    status: z.literal('ok'),
    kit: KitSchema,
    error: z.null(),
  }),
  z.object({
    id: z.string(),
    status: z.literal('failed'),
    kit: z.null(),
    error: z.object({
      code: BatchErrorCode,
      message: z.string(),
    }),
  }),
]);
export type BatchKitResult = z.infer<typeof BatchKitResultSchema>;

export const BatchOutputSchema = z.object({
  version: z.literal('1.0'),
  generated_at: z.string(),
  kits: z.array(BatchKitResultSchema),
});
export type BatchOutput = z.infer<typeof BatchOutputSchema>;
