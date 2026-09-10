import { z } from 'zod';

export const ApiErrorCode = z.enum([
  'VALIDATION_ERROR',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'DUPLICATE_SUBMISSION',
  'GENERATION_FAILED',
  'COMPANY_UNREACHABLE',
  'INTERNAL_ERROR',
]);
export type ApiErrorCode = z.infer<typeof ApiErrorCode>;

export interface ApiError {
  code: ApiErrorCode;
  message: string;
  details?: unknown;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  requestId: string;
}

export interface ApiFailure {
  success: false;
  error: ApiError;
  requestId: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export const RegisterRequestSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(200),
});
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const CreateKitRequestSchema = z.object({
  jd: z.string().min(1).max(20000),
  company_url: z.string().min(1).max(2000),
  days: z.number().int().min(1).max(60),
});
export type CreateKitRequest = z.infer<typeof CreateKitRequestSchema>;

export const CreateKitBatchRequestSchema = z.object({
  cases: z.array(CreateKitRequestSchema).min(1).max(50),
});
export type CreateKitBatchRequest = z.infer<typeof CreateKitBatchRequestSchema>;

export const ConfidenceLevel = z.enum(['low', 'medium', 'high']);
export type ConfidenceLevel = z.infer<typeof ConfidenceLevel>;

export const PracticeRequestSchema = z.object({
  confidence: ConfidenceLevel,
});
export type PracticeRequest = z.infer<typeof PracticeRequestSchema>;

export const ReorderRequestSchema = z.object({
  category: z.enum(['technical', 'behavioural', 'system-design', 'company-fit']),
  question_ids: z.array(z.string()),
});
export type ReorderRequest = z.infer<typeof ReorderRequestSchema>;
