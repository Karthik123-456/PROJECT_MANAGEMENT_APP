import { z } from 'zod';

const positiveId = z.coerce.number().int().positive();
const pageNumber = (defaultValue) => z.coerce.number().int().min(0).default(defaultValue);
const pageLimit = z.coerce.number().int().min(1).max(100).default(20);

export const projectIdParamsSchema = z.object({ id: positiveId }).strict();
export const memberParamsSchema = z.object({
  id: positiveId,
  userId: positiveId,
}).strict();
export const emptyParamsSchema = z.object({}).strict();
export const emptyQuerySchema = z.object({}).strict();

export const paginationQuerySchema = z.object({
  limit: pageLimit,
  offset: pageNumber(0),
}).strict();

export const projectListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(['active', 'archived']).default('active'),
}).strict();

export const createProjectSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().max(5000).nullable().optional(),
}).strict();

export const patchProjectSchema = createProjectSchema
  .partial()
  .refine((body) => Object.keys(body).length > 0, 'At least one field must be provided');

export const addMemberSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).email(),
  role: z.enum(['member', 'viewer']),
}).strict();

export const patchMemberSchema = z.object({
  role: z.enum(['member', 'viewer']),
}).strict();

export const userSearchQuerySchema = z.object({
  search: z.string().trim().min(2).max(100),
}).strict();
