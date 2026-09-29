import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DB_PATH: z.string().trim().min(1).default('./data/app.db'),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().trim().min(1).default('1h'),
  CORS_ORIGIN: z.string()
    .url()
    .refine((origin) => new URL(origin).origin === origin, 'must be a single origin without a path')
    .default('http://localhost:5173'),
  JOB_POLL_MS: z.coerce.number().int().positive().default(1000),
  JOB_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  JOB_LOCK_TIMEOUT_MS: z.coerce.number().int().positive().default(300000),
  REMINDER_SCAN_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  SIMULATE_EMAIL_FAILURE_RATE: z.coerce.number().min(0).max(1).default(0),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  const problems = result.error.issues
    .map(({ path, message }) => `- ${path.join('.')}: ${message}`)
    .join('\n');
  process.stderr.write(`Invalid environment configuration:\n${problems}\n`);
  process.exit(1);
}

export const env = Object.freeze(result.data);