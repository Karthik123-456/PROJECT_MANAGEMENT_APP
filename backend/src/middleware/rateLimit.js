import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

export function createRateLimiters({ enabled = env.NODE_ENV !== 'test' } = {}) {
  const createLimiter = ({ windowMs, limit, skipSuccessfulRequests = false }) =>
    rateLimit({
      windowMs,
      limit,
      skip: () => !enabled,
      skipSuccessfulRequests,
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) =>
        res.status(429).json({
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many requests',
            details: null,
          },
        }),
    });

  return {
    login: createLimiter({
      windowMs: 15 * 60 * 1000,
      limit: 10,
      skipSuccessfulRequests: true,
    }),
    register: createLimiter({
      windowMs: 15 * 60 * 1000,
      limit: 20,
    }),
  };
}
