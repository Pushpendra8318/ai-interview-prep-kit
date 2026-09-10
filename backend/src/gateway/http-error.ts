import type { ApiErrorCode } from '@prepkit/schema';

/** Thrown by route handlers/services; the central error handler turns this into the API envelope. */
export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: ApiErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }

  static badRequest(message: string, details?: unknown) {
    return new HttpError(400, 'VALIDATION_ERROR', message, details);
  }
  static unauthenticated(message = 'Authentication required') {
    return new HttpError(401, 'UNAUTHENTICATED', message);
  }
  static notFound(message = 'Not found') {
    return new HttpError(404, 'NOT_FOUND', message);
  }
  static conflict(message = 'Conflict') {
    return new HttpError(409, 'CONFLICT', message);
  }
  static duplicate(message = 'This job description and company were already submitted') {
    return new HttpError(409, 'DUPLICATE_SUBMISSION', message);
  }
}
