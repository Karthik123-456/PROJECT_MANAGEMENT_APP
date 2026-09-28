import { Router } from 'express';
import { createAuthController } from '../controllers/authController.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { createRateLimiters } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { createUserRepository } from '../repositories/userRepository.js';
import {
  emptyObjectSchema,
  loginSchema,
  registerSchema,
} from '../schemas/auth.js';
import { createAuthService } from '../services/authService.js';

export function createAuthRouter(db, { rateLimitEnabled } = {}) {
  const router = Router();
  const userRepository = createUserRepository(db);
  const authService = createAuthService(userRepository);
  const controller = createAuthController(authService);
  const requireAuthenticatedUser = requireAuth(userRepository);
  const limiters = createRateLimiters({ enabled: rateLimitEnabled });

  router.post(
    '/register',
    limiters.register,
    validate({
      body: registerSchema,
      params: emptyObjectSchema,
      query: emptyObjectSchema,
    }),
    controller.register,
  );
  router.post(
    '/login',
    limiters.login,
    validate({
      body: loginSchema,
      params: emptyObjectSchema,
      query: emptyObjectSchema,
    }),
    controller.login,
  );
  router.get(
    '/me',
    requireAuthenticatedUser,
    validate({
      params: emptyObjectSchema,
      query: emptyObjectSchema,
    }),
    controller.me,
  );

  return router;
}
