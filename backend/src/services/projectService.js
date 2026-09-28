import { AppError } from '../utils/AppError.js';

export function createProjectService(db, projectRepository, memberRepository, activityService) {
  return {
    list(userId, { status, limit, offset }) {
      const { rows, total } = projectRepository.listForUser({
        userId,
        status,
        limit,
        offset,
      });
      return { rows, total, limit, offset };
    },

    create({ user, name, description }) {
      let project;
      db.transaction(() => {
        project = projectRepository.create({
          name,
          description,
          ownerId: user.id,
        });
        memberRepository.add({ projectId: project.id, userId: user.id, role: 'owner' });
        activityService.record({
          projectId: project.id,
          actorId: user.id,
          entityType: 'project',
          entityId: project.id,
          action: 'project.created',
          meta: {},
        });
      }).immediate();
      return project;
    },

    update({ project, user, patch }) {
      let updated;
      const changedFields = Object.keys(patch);
      db.transaction(() => {
        updated = projectRepository.update({
          id: project.id,
          name: patch.name ?? project.name,
          description: Object.hasOwn(patch, 'description')
            ? patch.description
            : project.description,
        });
        activityService.record({
          projectId: project.id,
          actorId: user.id,
          entityType: 'project',
          entityId: project.id,
          action: 'project.updated',
          meta: { changed_fields: changedFields },
        });
      }).immediate();
      return updated;
    },

    archive({ project, user }) {
      db.transaction(() => {
        projectRepository.archive(project.id);
        activityService.record({
          projectId: project.id,
          actorId: user.id,
          entityType: 'project',
          entityId: project.id,
          action: 'project.archived',
          meta: {},
        });
      }).immediate();
    },

    restore({ project, user }) {
      let restored;
      db.transaction(() => {
        const current = projectRepository.findById(project.id);
        if (!current) {
          throw new AppError(404, 'NOT_FOUND', 'Resource not found');
        }
        if (!current.archived_at) {
          throw new AppError(409, 'PROJECT_NOT_ARCHIVED', 'Project is not archived');
        }
        restored = projectRepository.restore(project.id);
        activityService.record({
          projectId: project.id,
          actorId: user.id,
          entityType: 'project',
          entityId: project.id,
          action: 'project.restored',
          meta: {},
        });
      }).immediate();
      return restored;
    },
  };
}
