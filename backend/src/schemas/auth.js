import { z } from 'zod';

const emailSchema = z.string().trim().toLowerCase().max(254).email();
const passwordWithinBcryptLimit = (password) => Buffer.byteLength(password, 'utf8') <= 72;

const registerPasswordSchema = z
  .string()
  .min(8)
  .refine(passwordWithinBcryptLimit, 'Password must be at most 72 UTF-8 bytes');

const loginPasswordSchema = z
  .string()
  .min(1, 'Password is required')
  .refine(passwordWithinBcryptLimit, 'Password must be at most 72 UTF-8 bytes');

export const registerSchema = z
  .object({
    email: emailSchema,
    name: z.string().trim().min(1).max(100),
    password: registerPasswordSchema,
  })
  .strict();

export const loginSchema = z
  .object({
    email: emailSchema,
    password: loginPasswordSchema,
  })
  .strict();

export const emptyObjectSchema = z.object({}).strict();
