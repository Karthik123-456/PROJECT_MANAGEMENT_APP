import { Router } from 'express';
import { createStoryTaskController } from '../controllers/storyTaskController.js';
import { createProjectAccessMiddleware } from '../middleware/projectAccess.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validate } from '../middleware/validate.js';
import { createActivityRepository } from '../repositories/activityRepository.js';
import { createStoryTaskRepository } from '../repositories/storyTaskRepository.js';
import { createUserRepository } from '../repositories/userRepository.js';
import {
  createStorySchema,
  createTaskSchema,
  emptyStoryTaskParamsSchema,
  emptyStoryTaskQuerySchema,
  myTasksQuerySchema,
  patchStorySchema,
  patchTaskSchema,
  storyIdParamsSchema,
  storyListQuerySchema,
  taskIdParamsSchema,
  taskListQuerySchema,
} from '../schemas/storiesTasks.js';
import { createActivityService } from '../services/activityService.js';
import { createStoryTaskService } from '../services/storyTaskService.js';
import { projectIdParamsSchema } from '../schemas/projects.js';

export function createStoryTaskRouter(db) {
  const router = Router();
  const userRepository = createUserRepository(db);
  const projectAccess = createProjectAccessMiddleware(db);
  const activityService = createActivityService(createActivityRepository(db));
  const repository = createStoryTaskRepository(db);
  const service = createStoryTaskService(db, repository, activityService);
  const controller = createStoryTaskController(service);

  router.use(requireAuth(userRepository));

  router.get(
    '/projects/:id/tree',
    validate({ params: projectIdParamsSchema, query: emptyStoryTaskQuerySchema }),
    projectAccess('tree.read'),
    controller.tree,
  );
  router.get(
    '/projects/:id/stories',
    validate({ params: projectIdParamsSchema, query: storyListQuerySchema }),
    projectAccess('story.list'),
    controller.listStories,
  );
  router.post(
    '/projects/:id/stories',
    validate({
      body: createStorySchema,
      params: projectIdParamsSchema,
      query: emptyStoryTaskQuerySchema,
    }),
    projectAccess('story.create'),
    controller.createStory,
  );
  router.get(
    '/stories/:id',
    validate({ params: storyIdParamsSchema, query: emptyStoryTaskQuerySchema }),
    projectAccess('story.read', { from: 'story' }),
    controller.getStory,
  );
  router.patch(
    '/stories/:id',
    validate({
      body: patchStorySchema,
      params: storyIdParamsSchema,
      query: emptyStoryTaskQuerySchema,
    }),
    projectAccess('story.update', { from: 'story' }),
    controller.updateStory,
  );
  router.delete(
    '/stories/:id',
    validate({ params: storyIdParamsSchema, query: emptyStoryTaskQuerySchema }),
    projectAccess('story.delete', { from: 'story' }),
    controller.deleteStory,
  );
  router.get(
    '/stories/:id/tasks',
    validate({ params: storyIdParamsSchema, query: taskListQuerySchema }),
    projectAccess('task.list', { from: 'story' }),
    controller.listTasks,
  );
  router.post(
    '/stories/:id/tasks',
    validate({
      body: createTaskSchema,
      params: storyIdParamsSchema,
      query: emptyStoryTaskQuerySchema,
    }),
    projectAccess('task.create', { from: 'story' }),
    controller.createTask,
  );
  router.get(
    '/tasks/:id',
    validate({ params: taskIdParamsSchema, query: emptyStoryTaskQuerySchema }),
    projectAccess('task.read', { from: 'task' }),
    controller.getTask,
  );
  router.patch(
    '/tasks/:id',
    validate({
      body: patchTaskSchema,
      params: taskIdParamsSchema,
      query: emptyStoryTaskQuerySchema,
    }),
    projectAccess('task.update', { from: 'task' }),
    controller.updateTask,
  );
  router.delete(
    '/tasks/:id',
    validate({ params: taskIdParamsSchema, query: emptyStoryTaskQuerySchema }),
    projectAccess('task.delete', { from: 'task' }),
    controller.deleteTask,
  );
  router.get(
    '/me/tasks',
    validate({
      params: emptyStoryTaskParamsSchema,
      query: myTasksQuerySchema,
    }),
    controller.myTasks,
  );

  return router;
}
