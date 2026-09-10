import pino from 'pino';

export const rootLogger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport:
    process.env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } }
      : undefined,
});

export type Logger = pino.Logger;

/** Returns a child logger tagged with a request/job correlation id. */
export function withRequestId(requestId: string): Logger {
  return rootLogger.child({ requestId });
}
