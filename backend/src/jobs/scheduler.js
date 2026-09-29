import { env } from '../config/env.js';
import { enqueue, recoverStuck } from './queue.js';
import { logger } from '../utils/logger.js';

export function startRecovery(
  db,
  {
    lockTimeoutMs = env.JOB_LOCK_TIMEOUT_MS,
    intervalMs = env.JOB_POLL_MS,
    reminderScanMs = env.REMINDER_SCAN_MS,
    now = () => new Date(),
    setIntervalFn = setInterval,
    clearIntervalFn = clearInterval,
  } = {},
) {
  function enqueueReminderScan() {
    try {
      const timestamp = now();
      const tick = Math.floor(timestamp.getTime() / reminderScanMs);
      const jobId = enqueue(db, {
        type: 'due_reminder_scan',
        payload: {},
        idempotencyKey: `due-reminder-scan-${tick}`,
      });
      if (jobId !== null) {
        logger.info({ jobId }, 'Enqueued due-date reminder scan');
      }
    } catch (error) {
      logger.error({ err: error }, 'Could not enqueue due-date reminder scan');
    }
  }

  const recoveryTimer = setIntervalFn(() => {
    try {
      const recovered = recoverStuck(db, lockTimeoutMs);
      if (recovered > 0) {
        logger.warn({ recovered }, 'Recovered stuck jobs');
      }
    } catch (error) {
      logger.error({ err: error }, 'Job recovery failed');
    }
  }, intervalMs);

  enqueueReminderScan();
  const reminderTimer = setIntervalFn(enqueueReminderScan, reminderScanMs);

  return () => {
    clearIntervalFn(recoveryTimer);
    clearIntervalFn(reminderTimer);
  };
}
