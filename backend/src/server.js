import { createApp } from './app.js';
import { env } from './config/env.js';
import { createConnection } from './db/connection.js';
import { migrate } from './db/migrate.js';
import { logger } from './utils/logger.js';

const db = createConnection();

try {
  migrate(db);
} catch (error) {
  logger.fatal({ err: error }, 'Server startup failed during database migration');
  db.close();
  process.exit(1);
}

const server = createApp(db).listen(env.PORT, () => {
  logger.info({ port: env.PORT }, 'Server listening');
});

function shutdown(signal) {
  logger.info({ signal }, 'Shutting down server');
  server.close((error) => {
    db.close();
    if (error) {
      logger.error({ err: error }, 'Server shutdown failed');
      process.exitCode = 1;
    }
  });
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));