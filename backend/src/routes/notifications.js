import { Router } from 'express';
import { createNotificationController } from '../controllers/notificationController.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validate } from '../middleware/validate.js';
import { createNotificationRepository } from '../repositories/notificationRepository.js';
import { createUserRepository } from '../repositories/userRepository.js';
import {
  notificationIdParamsSchema,
  notificationListQuerySchema,
  notificationReadAllParamsSchema,
  notificationReadAllQuerySchema,
} from '../schemas/notifications.js';
import { createNotificationService } from '../services/notificationService.js';

export function createNotificationRouter(db) {
  const router = Router();
  const userRepository = createUserRepository(db);
  const service = createNotificationService(createNotificationRepository(db));
  const controller = createNotificationController(service);

  router.use(requireAuth(userRepository));
  router.get(
    '/',
    validate({
      params: notificationReadAllParamsSchema,
      query: notificationListQuerySchema,
    }),
    controller.list,
  );
  router.post(
    '/read-all',
    validate({
      params: notificationReadAllParamsSchema,
      query: notificationReadAllQuerySchema,
    }),
    controller.markAllRead,
  );
  router.post(
    '/:id/read',
    validate({
      params: notificationIdParamsSchema,
      query: notificationReadAllQuerySchema,
    }),
    controller.markRead,
  );

  return router;
}
