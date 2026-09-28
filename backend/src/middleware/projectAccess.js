import { AppError } from '../utils/AppError.js';
import { createProjectAccessRepository } from '../repositories/projectAccessRepository.js';

export const PROJECT_PERMISSIONS = Object.freeze({
  'project.read': Object.freeze(['owner', 'member', 'viewer']),
  'project.update': Object.freeze(['owner']),
  'project.archive': Object.freeze(['owner']),
  'project.restore': Object.freeze(['owner']),
  'member.list': Object.freeze(['owner', 'member', 'viewer']),
  'member.add': Object.freeze(['owner']),
  'member.role_change': Object.freeze(['owner']),
  'member.remove': Object.freeze(['owner']),
  'activity.read': Object.freeze(['owner', 'member', 'viewer']),
  'story.list': Object.freeze(['owner', 'member', 'viewer']),
  'story.read': Object.freeze(['owner', 'member', 'viewer']),
  'story.create': Object.freeze(['owner', 'member']),
  'story.update': Object.freeze(['owner', 'member']),
  'story.delete': Object.freeze(['owner']),
  'task.list': Object.freeze(['owner', 'member', 'viewer']),
  'task.read': Object.freeze(['owner', 'member', 'viewer']),
  'task.create': Object.freeze(['owner', 'member']),
  'task.update': Object.freeze(['owner', 'member']),
  'task.delete': Object.freeze(['owner', 'member']),
  'tree.read': Object.freeze(['owner', 'member', 'viewer']),
  'my_tasks.read': Object.freeze(['owner', 'member', 'viewer']),
});

const WRITE_ACTIONS = new Set([
  'project.update',
  'project.archive',
  'member.add',
  'member.role_change',
  'member.remove',
  'story.create',
  'story.update',
  'story.delete',
  'task.create',
  'task.update',
  'task.delete',
]);

const accessRepositories = new WeakMap();

export function resolveProjectAccess(db, { user, id, from }) {
  let repository = accessRepositories.get(db);
  if (!repository) {
    repository = createProjectAccessRepository(db);
    accessRepositories.set(db, repository);
  }
  return repository.findProjectAccess({ from, id, userId: user.id });
}

export function createProjectAccessMiddleware(db) {
  return function projectAccess(action, { from = 'project', param = 'id' } = {}) {
    const allowedRoles = PROJECT_PERMISSIONS[action];
    if (!allowedRoles) throw new Error(`Unknown project access action: ${action}`);

    return (req, res, next) => {
      const access = resolveProjectAccess(db, {
        user: req.user,
        id: req.validated.params[param],
        from,
      });
      if (!access) {
        return next(new AppError(404, 'NOT_FOUND', 'Resource not found'));
      }
      if (!allowedRoles.includes(access.role)) {
        return next(new AppError(403, 'FORBIDDEN', 'Insufficient project role'));
      }
      if (
        WRITE_ACTIONS.has(action)
        && access.project.archived_at
      ) {
        return next(new AppError(409, 'PROJECT_ARCHIVED', 'Archived projects are read-only'));
      }

      req.access = access;
      next();
    };
  };
}
