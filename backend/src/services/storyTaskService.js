import { AppError } from '../utils/AppError.js';
import { getUtcToday } from '../utils/date.js';

function missingAssignee() {
  return new AppError(
    422,
    'VALIDATION_ERROR',
    'Assignee must be a member of the project',
    [{ path: ['assignee_id'], code: 'custom', message: 'Assignee must be a member of the project' }],
  );
}

function missingResource() {
  return new AppError(404, 'NOT_FOUND', 'Resource not found');
}

function requireResource(resource) {
  if (!resource) throw missingResource();
  return resource;
}

function statusMeta(oldStatus, newStatus) {
  return oldStatus === newStatus ? {} : { old_status: oldStatus, new_status: newStatus };
}

function eventMeta(fields, statusChanges = {}) {
  const meta = { changed_fields: fields };
  if (Object.keys(statusChanges).length > 0) Object.assign(meta, statusChanges);
  return meta;
}

export function createStoryTaskService(
  db,
  repository,
  activityService,
  { today = getUtcToday } = {},
) {
  function validateAssignee(projectId, assigneeId) {
    if (assigneeId != null && !repository.isProjectMember(projectId, assigneeId)) {
      throw missingAssignee();
    }
  }

  function record({ projectId, actorId, entityType, entityId, action, meta }) {
    activityService.record({ projectId, actorId, entityType, entityId, action, meta });
  }

  return {
    listStories(projectId, query) {
      return repository.listStories({
        projectId,
        status: query.status ?? null,
        priority: query.priority ?? null,
        assigneeId: query.assignee_id ?? null,
        sort: query.sort,
        limit: query.limit,
        offset: query.offset,
      });
    },
    createStory({ projectId, actorId, body }) {
      let story;
      db.transaction(() => {
        validateAssignee(projectId, body.assignee_id ?? null);
        story = repository.createStory({
          projectId,
          title: body.title,
          description: body.description ?? null,
          acceptanceCriteria: body.acceptance_criteria ?? null,
          status: body.status,
          priority: body.priority,
          storyPoints: body.story_points ?? null,
          assigneeId: body.assignee_id ?? null,
          position: repository.nextStoryPosition(projectId),
        });
        record({
          projectId,
          actorId,
          entityType: 'story',
          entityId: story.id,
          action: 'story.created',
          meta: {},
        });
        if (story.status === 'done') {
          // STEP 7: enqueue send_notification
        }
      }).immediate();
      return story;
    },
    getStory(id) {
      return repository.getStory(id);
    },
    updateStory({ projectId, actorId, storyId, body }) {
      let story;
      db.transaction(() => {
        const current = requireResource(repository.getStory(storyId));
        const nextStatus = body.status ?? current.status;
        const statusChangedToDone = current.status !== 'done' && nextStatus === 'done';
        if (statusChangedToDone && repository.hasOpenTasks(storyId)) {
          throw new AppError(
            409,
            'STORY_HAS_OPEN_TASKS',
            'Story has tasks that are not done',
          );
        }
        if (Object.hasOwn(body, 'assignee_id')) {
          validateAssignee(projectId, body.assignee_id);
        }
        const changedFields = Object.keys(body);
        story = repository.updateStory({
          id: storyId,
          title: body.title ?? current.title,
          description: Object.hasOwn(body, 'description') ? body.description : current.description,
          acceptanceCriteria: Object.hasOwn(body, 'acceptance_criteria')
            ? body.acceptance_criteria
            : current.acceptance_criteria,
          status: nextStatus,
          priority: body.priority ?? current.priority,
          storyPoints: Object.hasOwn(body, 'story_points') ? body.story_points : current.story_points,
          assigneeId: Object.hasOwn(body, 'assignee_id') ? body.assignee_id : current.assignee_id,
          position: body.position ?? current.position,
        });
        record({
          projectId,
          actorId,
          entityType: 'story',
          entityId: storyId,
          action: 'story.updated',
          meta: eventMeta(changedFields, statusMeta(current.status, nextStatus)),
        });
        if (statusChangedToDone) {
          // STEP 7: enqueue send_notification
        }
      }).immediate();
      return story;
    },
    deleteStory({ projectId, actorId, storyId }) {
      db.transaction(() => {
        const story = requireResource(repository.getStory(storyId));
        repository.deleteStory(storyId);
        record({
          projectId,
          actorId,
          entityType: 'story',
          entityId: storyId,
          action: 'story.deleted',
          meta: { title: story.title },
        });
      }).immediate();
    },
    listTasks(storyId, query) {
      return repository.listTasks({
        storyId,
        status: query.status ?? null,
        assigneeId: query.assignee_id ?? null,
        limit: query.limit,
        offset: query.offset,
      });
    },
    createTask({ projectId, actorId, storyId, body }) {
      let task;
      db.transaction(() => {
        const story = requireResource(repository.getStorySummary(storyId));
        if (story.status === 'done') {
          throw new AppError(409, 'STORY_DONE', 'Cannot add a task to a done story');
        }
        validateAssignee(projectId, body.assignee_id ?? null);
        task = repository.createTask({
          storyId,
          title: body.title,
          description: body.description ?? null,
          status: body.status,
          assigneeId: body.assignee_id ?? null,
          estimateHours: body.estimate_hours ?? null,
          dueDate: body.due_date ?? null,
          position: repository.nextTaskPosition(storyId),
        });
        record({
          projectId,
          actorId,
          entityType: 'task',
          entityId: task.id,
          action: 'task.created',
          meta: {},
        });
        if (task.assignee_id != null) {
          // STEP 7: enqueue send_notification
        }
      }).immediate();
      return task;
    },
    getTask(id) {
      return repository.getTask(id);
    },
    updateTask({ projectId, actorId, taskId, body }) {
      let task;
      db.transaction(() => {
        const current = requireResource(repository.getTask(taskId));
        if (Object.hasOwn(body, 'assignee_id')) {
          validateAssignee(projectId, body.assignee_id);
        }
        const nextStatus = body.status ?? current.status;
        const changedFields = Object.keys(body);
        task = repository.updateTask({
          id: taskId,
          title: body.title ?? current.title,
          description: Object.hasOwn(body, 'description') ? body.description : current.description,
          status: nextStatus,
          assigneeId: Object.hasOwn(body, 'assignee_id') ? body.assignee_id : current.assignee_id,
          estimateHours: Object.hasOwn(body, 'estimate_hours')
            ? body.estimate_hours
            : current.estimate_hours,
          dueDate: Object.hasOwn(body, 'due_date') ? body.due_date : current.due_date,
          position: body.position ?? current.position,
        });
        record({
          projectId,
          actorId,
          entityType: 'task',
          entityId: taskId,
          action: 'task.updated',
          meta: eventMeta(changedFields, statusMeta(current.status, nextStatus)),
        });
        if (current.assignee_id !== task.assignee_id && task.assignee_id != null) {
          // STEP 7: enqueue send_notification
        }
        if (current.status !== nextStatus) {
          // STEP 7: enqueue send_notification
        }
      }).immediate();
      return task;
    },
    deleteTask({ projectId, actorId, taskId }) {
      db.transaction(() => {
        const task = requireResource(repository.getTask(taskId));
        repository.deleteTask(taskId);
        record({
          projectId,
          actorId,
          entityType: 'task',
          entityId: taskId,
          action: 'task.deleted',
          meta: { title: task.title },
        });
      }).immediate();
    },
    listMyTasks(userId, query) {
      const { rows, total } = repository.listMyTasks({
        userId,
        status: query.status ?? null,
        overdue: query.overdue,
        today: today(),
        limit: query.limit,
        offset: query.offset,
      });
      return { rows, total, limit: query.limit, offset: query.offset };
    },
    getTree(project, projectId) {
      const { stories, tasks } = repository.getTree(projectId);
      const byStory = new Map(stories.map((story) => [story.id, story]));
      for (const task of tasks) byStory.get(task.story_id).tasks.push(task);
      return { project, stories };
    },
  };
}
