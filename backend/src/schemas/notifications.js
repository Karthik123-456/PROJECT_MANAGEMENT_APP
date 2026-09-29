import { z } from 'zod';
import { emptyParamsSchema, paginationQuerySchema } from './projects.js';

const positiveId = z.coerce.number().int().positive();

export const notificationIdParamsSchema = z.object({
  id: positiveId,
}).strict();

export const notificationListQuerySchema = paginationQuerySchema.extend({
  unread: z.enum(['true', 'false']).default('false'),
}).strict();

export const notificationReadAllParamsSchema = emptyParamsSchema;

export const notificationReadAllQuerySchema = z.object({}).strict();
