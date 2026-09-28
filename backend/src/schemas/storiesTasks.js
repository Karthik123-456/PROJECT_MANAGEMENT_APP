import { z } from 'zod';

const positiveId = z.coerce.number().int().positive();
const pagination = {
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
};

export const storyIdParamsSchema = z.object({ id: positiveId }).strict();
export const taskIdParamsSchema = z.object({ id: positiveId }).strict();
export const storyListQuerySchema = z.object({
  ...pagination,
  status: z.enum(['backlog', 'in_progress', 'in_review', 'done']).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  assignee_id: positiveId.optional(),
  sort: z.enum([
    'position', '-position',
    'priority', '-priority',
    'created_at', '-created_at',
    'story_points', '-story_points',
  ]).default('position'),
}).strict();
export const taskListQuerySchema = z.object({
  ...pagination,
  status: z.enum(['todo', 'in_progress', 'done']).optional(),
  assignee_id: positiveId.optional(),
}).strict();
export const myTasksQuerySchema = z.object({
  ...pagination,
  status: z.enum(['todo', 'in_progress', 'done']).optional(),
  overdue: z.enum(['true', 'false']).optional().transform((value) => value === 'true'),
}).strict();

const optionalNullableText = (max) => z.string().max(max).nullable().optional();
const assigneeIdSchema = positiveId.nullable();

const storyFields = {
  title: z.string().trim().min(1).max(200),
  description: optionalNullableText(5000),
  acceptance_criteria: optionalNullableText(5000),
  status: z.enum(['backlog', 'in_progress', 'in_review', 'done']).default('backlog'),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  story_points: z.number().int().min(0).max(100).nullable().optional(),
  assignee_id: assigneeIdSchema.optional(),
};
export const createStorySchema = z.object(storyFields).strict();
export const patchStorySchema = z.object({
  ...storyFields,
  position: z.number().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
}).partial().strict()
  .refine((body) => Object.keys(body).length > 0, 'At least one field must be provided');

const taskFields = {
  title: z.string().trim().min(1).max(200),
  description: optionalNullableText(5000),
  status: z.enum(['todo', 'in_progress', 'done']).default('todo'),
  assignee_id: assigneeIdSchema.optional(),
  estimate_hours: z.number().min(0).nullable().optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional()
    .refine((value) => value == null || isRealDate(value), 'Must be a real YYYY-MM-DD date'),
};
export const createTaskSchema = z.object(taskFields).strict();
export const patchTaskSchema = z.object({
  ...taskFields,
  position: z.number().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
}).partial().strict()
  .refine((body) => Object.keys(body).length > 0, 'At least one field must be provided');

export function isRealDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

export const emptyStoryTaskParamsSchema = z.object({}).strict();
export const emptyStoryTaskQuerySchema = z.object({}).strict();
