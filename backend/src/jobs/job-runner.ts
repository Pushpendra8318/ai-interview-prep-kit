import { GenerationJobModel } from '@prepkit/db';
import { rootLogger } from '@prepkit/logger';
import { runGenerationForKit } from '../modules/kits/kits.service.js';

const POLL_INTERVAL_MS = 2000;

/**
 * In-process job runner (README "Service topology" deviation): generation
 * runs as an async job inside the same API process rather than a separate
 * always-on worker dyno, tracked entirely through the generation_jobs
 * collection so progress/recovery behave exactly as the brief specifies
 * without needing a second free-tier service or Redis.
 */
export function startJobRunner(): () => void {
  let processing = false;
  let stopped = false;

  const timer = setInterval(() => {
    void tick();
  }, POLL_INTERVAL_MS);

  async function tick() {
    if (processing || stopped) return;
    processing = true;
    try {
      const job = await GenerationJobModel.findOne({ status: 'queued' }).sort({ createdAt: 1 });
      if (job) {
        await runGenerationForKit(job.kitId.toString());
      }
    } catch (error) {
      rootLogger.error({ err: error }, 'Job runner tick failed');
    } finally {
      processing = false;
    }
  }

  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
