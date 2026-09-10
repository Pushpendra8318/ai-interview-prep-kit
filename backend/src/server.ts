import 'dotenv/config';
import { connectDb } from '@prepkit/db';
import { rootLogger } from '@prepkit/logger';
import { createApp } from './app.js';
import { getEnv } from './context.js';
import { startJobRunner } from './jobs/job-runner.js';

async function main() {
  const env = getEnv();
  await connectDb(env.MONGODB_URI);
  rootLogger.info('Connected to MongoDB');

  const app = createApp(env);
  const stopJobRunner = startJobRunner();

  const server = app.listen(env.PORT, () => {
    rootLogger.info(`API listening on port ${env.PORT}`);
  });

  const shutdown = () => {
    rootLogger.info('Shutting down...');
    stopJobRunner();
    server.close(() => process.exit(0));
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((error) => {
  rootLogger.error({ err: error }, 'Fatal startup error');
  process.exit(1);
});
