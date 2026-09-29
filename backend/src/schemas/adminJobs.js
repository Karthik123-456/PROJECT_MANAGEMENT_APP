import { z } from 'zod';
import { paginationQuerySchema } from './projects.js';

export const adminJobsQuerySchema = paginationQuerySchema.extend({
  status: z.enum(['pending', 'running', 'succeeded', 'dead']).default('dead'),
}).strict();

export const adminJobIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
}).strict();
