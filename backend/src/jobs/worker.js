import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../config/env.js';
import { createConnection } from '../db/connection.js';
import { migrate } from '../db/migrate.js';
import { logger } from '../utils/logger.js';
import { sendNotification } from './handlers/sendNotification.js';
import { claim, complete, fail, recoverStuck } from './queue.js';
import { startRecovery } from './scheduler.js';

const handlers = Object.freeze({
  send_notification: sendNotification,
});

export async function processNextJob({
  db,
  workerId,
  jobHandlers = handlers,
  now = () => new Date(),
  random = Math.random,
} = {}) {
  const job = claim(db, workerId, { now });
  if (!job) return false;

  try {
    const handler = Object.hasOwn(jobHandlers, job.type)
      ? jobHandlers[job.type]
      : null;
    if (typeof handler !== 'function') {
      throw new Error(`No handler registered for job type "${job.type}"`);
    }

    // A crash after this handler commits but before complete() is at-least-once delivery; handlers deduplicate with the persisted job idempotency key.
    const result = await handler(db, job.payload, job);
    if (!complete(db, job.id, workerId, result, { now })) {
      logger.warn({ jobId: job.id, workerId }, 'Job completion lost its worker lock');
    } else {
      logger.info({ jobId: job.id, type: job.type }, 'Job completed');
    }
  } catch (error) {
    const recorded = fail(
      db,
      job.id,
      workerId,
      error,
      (claimedJob) => claimedJob.max_attempts,
      { now, random },
    );
    logger.error({
      err: error,
      jobId: job.id,
      workerId,
      failureRecorded: recorded,
    }, 'Job handler failed');
  }

  return true;
}

export function startWorker({
  db,
  workerId = `${process.pid}-${randomUUID()}`,
  jobHandlers = handlers,
  pollMs = env.JOB_POLL_MS,
  lockTimeoutMs = env.JOB_LOCK_TIMEOUT_MS,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
} = {}) {
  let stopping = false;
  let wakeDelay = null;
  let stopRecovery = () => {};

  const done = (async () => {
    const recovered = recoverStuck(db, lockTimeoutMs);
    if (recovered > 0) {
      logger.warn({ recovered }, 'Recovered stuck jobs at worker startup');
    }
    stopRecovery = startRecovery(db, { lockTimeoutMs });

    try {
      while (!stopping) {
        const processed = await processNextJob({ db, workerId, jobHandlers });
        if (!processed && !stopping) {
          await new Promise((resolve) => {
            const timer = setTimeoutFn(() => {
              wakeDelay = null;
              resolve();
            }, pollMs);
            wakeDelay = () => {
              clearTimeoutFn(timer);
              wakeDelay = null;
              resolve();
            };
          });
        }
      }
    } finally {
      stopRecovery();
    }
  })();

  return {
    workerId,
    done,
    stop() {
      stopping = true;
      wakeDelay?.();
    },
  };
}

async function runWorkerProcess() {
  const db = createConnection();
  try {
    migrate(db);
  } catch (error) {
    db.close();
    throw error;
  }

  const worker = startWorker({ db });
  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'Worker shutdown requested');
    worker.stop();
    worker.done
      .then(() => db.close())
      .catch((error) => {
        logger.fatal({ err: error }, 'Worker shutdown failed');
        db.close();
        process.exitCode = 1;
      });
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));

  try {
    await worker.done;
  } catch (error) {
    logger.fatal({ err: error }, 'Worker stopped unexpectedly');
    db.close();
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runWorkerProcess().catch((error) => {
    logger.fatal({ err: error }, 'Worker startup failed');
    process.exitCode = 1;
  });
}
