import { Router } from 'express';
import { createAdminJobController } from '../controllers/adminJobController.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validate } from '../middleware/validate.js';
import { createAdminJobRepository } from '../repositories/adminJobRepository.js';
import { createUserRepository } from '../repositories/userRepository.js';
import {
  adminJobIdParamsSchema,
  adminJobsQuerySchema,
} from '../schemas/adminJobs.js';
import { createAdminJobService } from '../services/adminJobService.js';

export function createAdminJobsRouter(db) {
  const router = Router();
  const userRepository = createUserRepository(db);
  const service = createAdminJobService(createAdminJobRepository(db));
  const controller = createAdminJobController(service);

  router.use(requireAuth(userRepository), requireAdmin);
  router.get(
    '/',
    validate({ query: adminJobsQuerySchema }),
    controller.list,
  );
  router.post(
    '/:id/retry',
    validate({ params: adminJobIdParamsSchema }),
    controller.retry,
  );

  return router;
}
