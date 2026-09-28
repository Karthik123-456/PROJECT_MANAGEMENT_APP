import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { createAuthRouter } from './routes/auth.js';
import { createHealthRepository } from './repositories/healthRepository.js';

export function createApp(db, { rateLimitEnabled } = {}) {
  const app = express();
  const healthRepository = createHealthRepository(db);

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', (req, res) => {
    healthRepository.check();
    res.status(200).json({ status: 'ok' });
  });

  app.use('/api/v1/auth', createAuthRouter(db, { rateLimitEnabled }));

  app.use((req, res) => {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found',
        details: null,
      },
    });
  });

  app.use(errorHandler);
  return app;
}