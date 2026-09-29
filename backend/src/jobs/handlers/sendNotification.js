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
      const recipientId = payload.recipientId
        ?? repository.findProjectOwner(payload.projectId)?.user_id;
      if (!recipientId) {
        throw new Error(`No notification recipient found for project ${payload.projectId}`);
      }

      repository.create({
        userId: recipientId,
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
        recipientId,
      }, 'Simulated notification email sent');

      return { notificationQueued: true };
    }).immediate();
  };
}

export const sendNotification = createSendNotificationHandler();
