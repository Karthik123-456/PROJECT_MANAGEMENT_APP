import { env } from '../config/env.js';
import { recoverStuck } from './queue.js';
import { logger } from '../utils/logger.js';

export function startRecovery(
  db,
  {
    lockTimeoutMs = env.JOB_LOCK_TIMEOUT_MS,
    intervalMs = env.JOB_POLL_MS,
    setIntervalFn = setInterval,
    clearIntervalFn = clearInterval,
  } = {},
) {
  const timer = setIntervalFn(() => {
    try {
      const recovered = recoverStuck(db, lockTimeoutMs);
      if (recovered > 0) {
        logger.warn({ recovered }, 'Recovered stuck jobs');
      }
    } catch (error) {
      logger.error({ err: error }, 'Job recovery failed');
    }
  }, intervalMs);

  return () => clearIntervalFn(timer);
}
