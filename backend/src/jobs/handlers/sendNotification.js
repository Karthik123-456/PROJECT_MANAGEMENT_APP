import { env } from '../../config/env.js';
import { createNotificationRepository } from '../../repositories/notificationRepository.js';
import { logger } from '../../utils/logger.js';

export function createSendNotificationHandler({
  failureRate = env.SIMULATE_EMAIL_FAILURE_RATE,
  random = Math.random,
} = {}) {
  return function sendNotification(db, payload, job) {
    if (!job?.idempotency_key) {
      throw new Error('Notification job is missing its idempotency key');
    }
    if (failureRate < 0 || failureRate > 1) {
      throw new RangeError('failureRate must be between 0 and 1');
    }

    const repository = createNotificationRepository(db);
    return db.transaction(() => {
      const owner = repository.findProjectOwner(payload.projectId);
      if (!owner) {
        throw new Error(`Project ${payload.projectId} has no owner`);
      }

      repository.create({
        userId: owner.user_id,
        type: payload.kind,
        payload,
        idempotencyKey: job.idempotency_key,
      });

      if (random() < failureRate) {
        throw new Error('Simulated email delivery failure');
      }

      logger.info({
        kind: payload.kind,
        projectId: payload.projectId,
        recipientId: owner.user_id,
      }, 'Simulated notification email sent');

      return { notificationQueued: true };
    }).immediate();
  };
}

export const sendNotification = createSendNotificationHandler();
