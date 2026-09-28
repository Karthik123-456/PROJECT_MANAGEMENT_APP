import { Router } from 'express';
import { createProjectController } from '../controllers/projectController.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { createProjectAccessMiddleware } from '../middleware/projectAccess.js';
import { validate } from '../middleware/validate.js';
import { createActivityRepository } from '../repositories/activityRepository.js';
import { createMemberRepository } from '../repositories/memberRepository.js';
import { createProjectRepository } from '../repositories/projectRepository.js';
import { createUserRepository } from '../repositories/userRepository.js';
import {
  addMemberSchema,
  emptyParamsSchema,
  emptyQuerySchema,
  memberParamsSchema,
  paginationQuerySchema,
  patchMemberSchema,
  patchProjectSchema,
  projectIdParamsSchema,
  projectListQuerySchema,
  createProjectSchema,
} from '../schemas/projects.js';
import { createActivityService } from '../services/activityService.js';
import { createMemberService } from '../services/memberService.js';
import { createProjectService } from '../services/projectService.js';

export function createProjectRouter(db) {
  const router = Router();
  const userRepository = createUserRepository(db);
  const requireAuthenticatedUser = requireAuth(userRepository);
  const projectAccess = createProjectAccessMiddleware(db);
  const projectRepository = createProjectRepository(db);
  const memberRepository = createMemberRepository(db);
  const activityService = createActivityService(createActivityRepository(db));
  const projectService = createProjectService(
    db,
    projectRepository,
    memberRepository,
    activityService,
  );
  const memberService = createMemberService(db, memberRepository, activityService);
  const controller = createProjectController(projectService, memberService, activityService);

  router.use(requireAuthenticatedUser);
  router.get(
    '/',
    validate({ params: emptyParamsSchema, query: projectListQuerySchema }),
    controller.list,
  );
  router.post(
    '/',
    validate({
      body: createProjectSchema,
      params: emptyParamsSchema,
      query: emptyQuerySchema,
    }),
    controller.create,
  );

  router.get(
    '/:id',
    validate({ params: projectIdParamsSchema, query: emptyQuerySchema }),
    projectAccess('project.read'),
    controller.get,
  );
  router.patch(
    '/:id',
    validate({
      body: patchProjectSchema,
      params: projectIdParamsSchema,
      query: emptyQuerySchema,
    }),
    projectAccess('project.update'),
    controller.update,
  );
  router.delete(
    '/:id',
    validate({ params: projectIdParamsSchema, query: emptyQuerySchema }),
    projectAccess('project.archive'),
    controller.archive,
  );
  router.post(
    '/:id/restore',
    validate({
      params: projectIdParamsSchema,
      query: emptyQuerySchema,
    }),
    projectAccess('project.restore'),
    controller.restore,
  );

  router.get(
    '/:id/members',
    validate({ params: projectIdParamsSchema, query: paginationQuerySchema }),
    projectAccess('member.list'),
    controller.listMembers,
  );
  router.post(
    '/:id/members',
    validate({
      body: addMemberSchema,
      params: projectIdParamsSchema,
      query: emptyQuerySchema,
    }),
    projectAccess('member.add'),
    controller.addMember,
  );
  router.patch(
    '/:id/members/:userId',
    validate({
      body: patchMemberSchema,
      params: memberParamsSchema,
      query: emptyQuerySchema,
    }),
    projectAccess('member.role_change'),
    controller.changeMemberRole,
  );
  router.delete(
    '/:id/members/:userId',
    validate({
      params: memberParamsSchema,
      query: emptyQuerySchema,
    }),
    projectAccess('member.remove'),
    controller.removeMember,
  );
  router.get(
    '/:id/activity',
    validate({ params: projectIdParamsSchema, query: paginationQuerySchema }),
    projectAccess('activity.read'),
    controller.activity,
  );

  return router;
}
