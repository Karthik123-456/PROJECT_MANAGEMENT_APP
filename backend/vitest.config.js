import { defineConfig } from 'vitest/config';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'auth-test-secret-at-least-16-characters';
process.env.DB_PATH = ':memory:';

export default defineConfig({
  test: {
    environment: 'node',
    restoreMocks: true,
    clearMocks: true,
  },
});
