import { Router } from 'express';
import { createDirectoryController } from '../controllers/directoryController.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validate } from '../middleware/validate.js';
import { createDirectoryRepository } from '../repositories/directoryRepository.js';
import { createUserRepository } from '../repositories/userRepository.js';
import { emptyParamsSchema, userSearchQuerySchema } from '../schemas/projects.js';
import { createDirectoryService } from '../services/directoryService.js';

export function createUsersRouter(db) {
  const router = Router();
  const userRepository = createUserRepository(db);
  const directoryService = createDirectoryService(createDirectoryRepository(db));
  const controller = createDirectoryController(directoryService);

  router.get(
    '/',
    requireAuth(userRepository),
    validate({
      params: emptyParamsSchema,
      query: userSearchQuerySchema,
    }),
    controller.searchUsers,
  );
  return router;
}
