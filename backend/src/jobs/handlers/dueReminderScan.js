import { createStoryTaskRepository } from '../../repositories/storyTaskRepository.js';
import { getUtcDate, getUtcDateWindow } from '../../utils/dates.js';
import { enqueue } from '../queue.js';

export function createDueReminderScanHandler({
  now = () => new Date(),
} = {}) {
  return function dueReminderScan(db) {
    const currentTime = now();
    const utcToday = getUtcDate(currentTime);
    const { dueSoonThroughDate } = getUtcDateWindow(currentTime);
    const repository = createStoryTaskRepository(db);
    const tasks = repository.listTasksForDueReminders({
      utcToday,
      dueSoonThroughDate,
    });
    let enqueued = 0;

    for (const task of tasks) {
      const kind = task.due_date < utcToday ? 'task_overdue' : 'task_due_soon';
      const typeKey = kind === 'task_overdue' ? 'overdue' : 'due_soon';
      const idempotencyKey = `${typeKey}-task-${task.task_id}-${utcToday}`;
      const jobId = enqueue(db, {
        type: 'send_notification',
        payload: {
          kind,
          recipientId: task.assignee_id,
          taskId: task.task_id,
          taskTitle: task.task_title,
          storyTitle: task.story_title,
          projectId: task.project_id,
          projectName: task.project_name,
          dueDate: task.due_date,
        },
        idempotencyKey,
      });
      if (jobId !== null) enqueued += 1;
    }

    return { scanned: tasks.length, enqueued, utcDate: utcToday };
  };
}

export const dueReminderScan = createDueReminderScanHandler();
