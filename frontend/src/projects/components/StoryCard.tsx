import { useState } from 'react'
import type {
  ProjectRole,
  StoryStatus,
  StoryTree,
  TaskStatus,
} from '../../api/types.ts'
import { ProgressBar } from './ProgressBar.tsx'
import { formatUtcDate, isOverdue } from '../utcDate.ts'
import { projectErrorMessage } from '../projectErrors.ts'

const storyStatuses: StoryStatus[] = [
  'backlog',
  'in_progress',
  'in_review',
  'done',
]
const taskStatuses: TaskStatus[] = ['todo', 'in_progress', 'done']

function readableStatus(status: string): string {
  return status.replaceAll('_', ' ')
}

function storyStatusClasses(status: StoryStatus): string {
  switch (status) {
    case 'done':
      return 'border-status-green-line bg-status-green-bg text-status-green-text'
    case 'in_review':
      return 'border-status-amber-line bg-status-amber-bg text-status-amber-text'
    case 'backlog':
      return 'border-status-gray-line bg-status-gray-bg text-status-gray-text'
    case 'in_progress':
      return 'border-status-blue-line bg-status-blue-bg text-status-blue-text'
  }
}

function taskStatusClasses(status: TaskStatus): string {
  switch (status) {
    case 'done':
      return 'border-status-green-line bg-status-green-bg text-status-green-text'
    case 'in_progress':
      return 'border-status-blue-line bg-status-blue-bg text-status-blue-text'
    case 'todo':
      return 'border-status-gray-line bg-status-gray-bg text-status-gray-text'
  }
}

function priorityClasses(priority: string): string {
  switch (priority) {
    case 'high':
      return 'bg-priority-high text-priority-neutral-text'
    case 'medium':
      return 'bg-priority-medium text-priority-medium-text'
    default:
      return 'bg-priority-low text-priority-neutral-text'
  }
}

function storyStatusIndicator(status: StoryStatus): string {
  switch (status) {
    case 'done':
      return 'border-l-status-done'
    case 'in_review':
      return 'border-l-status-in-review'
    case 'backlog':
      return 'border-l-status-backlog'
    case 'in_progress':
      return 'border-l-status-in-progress'
  }
}

function taskStatusIndicator(status: TaskStatus): string {
  switch (status) {
    case 'done':
      return 'border-l-status-done'
    case 'in_progress':
      return 'border-l-status-in-progress'
    case 'todo':
      return 'border-l-status-backlog'
  }
}

function Assignee({ name }: { name: string | undefined }) {
  return (
    <span className="text-xs text-muted">
      Assignee: {name ?? 'Unassigned'}
    </span>
  )
}

function TaskRow({
  task,
  canWrite,
  canDelete,
  statusPending,
  today,
  onChangeStatus,
  onEdit,
  onDelete,
}: {
  task: StoryTree['tasks'][number]
  canWrite: boolean
  canDelete: boolean
  statusPending: boolean
  today: string
  onChangeStatus: (taskId: number, status: TaskStatus) => Promise<void>
  onEdit: (task: StoryTree['tasks'][number]) => void
  onDelete: (task: StoryTree['tasks'][number]) => void
}) {
  const [error, setError] = useState('')
  const overdue = isOverdue(task.due_date, task.status, today)

  async function changeStatus(status: TaskStatus) {
    setError('')
    try {
      await onChangeStatus(task.id, status)
    } catch (reason) {
      setError(projectErrorMessage(reason))
    }
  }

  return (
    <li className={`min-w-0 rounded-md border border-l-2 border-line bg-surface p-3 shadow-sm shadow-black/15 ${taskStatusIndicator(task.status)}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className={`break-words text-sm font-semibold leading-snug ${task.status === 'done' ? 'text-muted line-through' : 'text-ink'}`}>
            {task.title}
          </h4>
          {task.description && (
            <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-secondary">
              {task.description}
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            <Assignee name={task.assignee?.name} />
            {task.due_date && (
              <span
                className={`text-xs ${overdue ? 'font-semibold text-red-300' : 'text-muted'}`}
              >
                {overdue ? 'Overdue · ' : ''}
                Due <time dateTime={task.due_date}>{formatUtcDate(task.due_date)}</time>
              </span>
            )}
            {task.estimate_hours !== null && (
              <span className="text-xs text-muted">
                Estimate: {task.estimate_hours} hours
              </span>
            )}
          </div>
          {overdue && (
            <span className="sr-only">This task is overdue.</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canWrite ? (
            <>
              <label className="sr-only" htmlFor={`task-status-${task.id}`}>
                Status for {task.title}
              </label>
              <select
                id={`task-status-${task.id}`}
                aria-label={`Status for ${task.title}`}
                value={task.status}
                disabled={statusPending}
                onChange={(event) =>
                  void changeStatus(event.target.value as TaskStatus)
                }
                className={`max-w-36 border px-3 py-1.5 text-xs capitalize transition hover:brightness-110 focus:ring-2 focus:ring-accent/50 ${taskStatusClasses(task.status)}`}
              >
                {taskStatuses.map((status) => (
                  <option key={status} value={status}>
                    {readableStatus(status)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => onEdit(task)}
                aria-label={`Edit task ${task.title}`}
                className="rounded-md border border-line px-2.5 py-1.5 text-xs font-semibold text-secondary transition hover:bg-surface-hover"
              >
                Edit
              </button>
            </>
          ) : (
            <span className={`rounded-full border px-2 py-1 text-xs capitalize ${taskStatusClasses(task.status)}`}>
              {readableStatus(task.status)}
            </span>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={() => onDelete(task)}
              aria-label={`Delete task ${task.title}`}
              className="rounded-md px-2 py-1.5 text-xs font-semibold text-red-300 transition hover:bg-red-950/50"
            >
              Delete
            </button>
          )}
        </div>
      </div>
      {error && (
        <p role="alert" aria-live="polite" className="mt-2 text-sm text-red-300">
          {error}
        </p>
      )}
    </li>
  )
}

export interface StoryCardProps {
  story: StoryTree
  role: ProjectRole
  archived: boolean
  statusPending: boolean
  today: string
  onStoryStatus: (storyId: number, status: StoryStatus) => Promise<void>
  onTaskStatus: (taskId: number, status: TaskStatus) => Promise<void>
  onEditStory: (story: StoryTree) => void
  onDeleteStory: (story: StoryTree) => void
  onAddTask: (storyId: number) => void
  onEditTask: (storyId: number, task: StoryTree['tasks'][number]) => void
  onDeleteTask: (task: StoryTree['tasks'][number]) => void
}

export function StoryCard({
  story,
  role,
  archived,
  statusPending,
  today,
  onStoryStatus,
  onTaskStatus,
  onEditStory,
  onDeleteStory,
  onAddTask,
  onEditTask,
  onDeleteTask,
}: StoryCardProps) {
  const [expanded, setExpanded] = useState(true)
  const [statusError, setStatusError] = useState('')
  const canWrite = !archived && role !== 'viewer'
  const canDeleteStory = !archived && role === 'owner'
  const canDeleteTask = !archived && role !== 'viewer'

  async function changeStatus(status: StoryStatus) {
    setStatusError('')
    try {
      await onStoryStatus(story.id, status)
    } catch (error) {
      setStatusError(projectErrorMessage(error))
    }
  }

  return (
    <article className={`min-w-0 rounded-md border border-l-4 border-line bg-surface shadow-sm shadow-black/20 transition duration-200 hover:-translate-y-px hover:bg-surface-hover hover:shadow-md ${storyStatusIndicator(story.status)}`}>
      <div className="flex flex-wrap items-start justify-between gap-3 p-4 sm:p-[18px]">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <button
            type="button"
            aria-expanded={expanded}
            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${story.title}`}
            onClick={() => setExpanded((value) => !value)}
            className="mt-0.5 rounded px-1 font-semibold text-muted transition hover:bg-surface-hover hover:text-ink"
          >
            {expanded ? '−' : '+'}
          </button>
          <div className="min-w-0 flex-1">
            <h3 className={`break-words text-lg font-bold leading-snug tracking-tight ${story.status === 'done' ? 'text-muted line-through' : 'text-ink'}`}>
              {story.title}
            </h3>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-secondary">
              <span className={`rounded-full border px-2.5 py-1 font-semibold capitalize ${storyStatusClasses(story.status)}`}>
                {readableStatus(story.status)}
              </span>
              <span className={`rounded-full px-2.5 py-1 font-semibold capitalize ${priorityClasses(story.priority)}`}>
                {story.priority} priority
              </span>
              {story.story_points !== null && (
                <span>Story points: {story.story_points}</span>
              )}
              <Assignee name={story.assignee?.name} />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canWrite && (
            <>
              <label className="sr-only" htmlFor={`story-status-${story.id}`}>
                Status for {story.title}
              </label>
              <select
                id={`story-status-${story.id}`}
                aria-label={`Status for ${story.title}`}
                value={story.status}
                disabled={statusPending}
                onChange={(event) =>
                  void changeStatus(event.target.value as StoryStatus)
                }
                className={`max-w-40 border px-3 py-1.5 text-xs capitalize transition hover:brightness-110 focus:ring-2 focus:ring-accent/50 ${storyStatusClasses(story.status)}`}
              >
                {storyStatuses.map((status) => (
                  <option key={status} value={status}>
                    {readableStatus(status)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => onEditStory(story)}
                aria-label={`Edit story ${story.title}`}
                className="rounded-md border border-line px-2.5 py-1.5 text-xs font-semibold text-secondary transition hover:bg-surface"
              >
                Edit
              </button>
            </>
          )}
          {canDeleteStory && (
            <button
              type="button"
              onClick={() => onDeleteStory(story)}
              aria-label={`Delete story ${story.title}`}
              className="rounded-md px-2.5 py-1.5 text-xs font-semibold text-red-300 transition hover:bg-red-950/50"
            >
              Delete
            </button>
          )}
        </div>
      </div>
      {statusError && (
        <p role="alert" aria-live="polite" className="px-5 pb-3 text-sm text-red-300">
          {statusError}
        </p>
      )}

      {expanded && (
        <div className="space-y-4 border-t border-line px-4 py-4 sm:px-5">
          <ProgressBar progress={story.progress} />
          {story.description && (
            <p className="whitespace-pre-wrap break-words text-sm text-secondary">
              {story.description}
            </p>
          )}
          {story.acceptance_criteria && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">
                Acceptance criteria
              </h4>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm text-secondary">
                {story.acceptance_criteria}
              </p>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h4 className="text-sm font-semibold text-ink">
              Tasks ({story.tasks.length})
            </h4>
            {canWrite && story.status !== 'done' && (
              <button
                type="button"
                onClick={() => onAddTask(story.id)}
                className="rounded-md border border-accent/50 px-3 py-1.5 text-sm font-semibold text-accent-hover transition hover:bg-accent/10"
              >
                Add task
              </button>
            )}
          </div>
          {story.tasks.length === 0 ? (
            <p className="rounded-md bg-surface-hover/60 px-3 py-4 text-sm text-muted">No tasks in this story.</p>
          ) : (
            <ul className="min-w-0 space-y-2">
              {story.tasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  canWrite={canWrite}
                  canDelete={canDeleteTask}
                  statusPending={statusPending}
                  today={today}
                  onChangeStatus={onTaskStatus}
                  onEdit={(item) => onEditTask(story.id, item)}
                  onDelete={onDeleteTask}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </article>
  )
}
