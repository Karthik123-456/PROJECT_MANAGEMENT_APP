import type {
  Member,
  StoryPriority,
  StoryStatus,
  TaskStatus,
} from '../../api/types.ts'

export interface FilterValues {
  storyStatus: string
  priority: string
  assignee: string
  taskStatus: string
}

interface ProjectFiltersProps {
  values: FilterValues
  members: Member[]
  onChange: (key: keyof FilterValues, value: string) => void
  onReset: () => void
}

const storyStatuses: StoryStatus[] = [
  'backlog',
  'in_progress',
  'in_review',
  'done',
]
const priorities: StoryPriority[] = ['low', 'medium', 'high']
const taskStatuses: TaskStatus[] = ['todo', 'in_progress', 'done']

function label(value: string): string {
  return value.replaceAll('_', ' ')
}

export function ProjectFilters({
  values,
  members,
  onChange,
  onReset,
}: ProjectFiltersProps) {
  return (
    <section
      aria-label="Filter project work"
      className="mb-5 grid min-w-0 gap-3 rounded-md border border-line bg-surface-hover/70 p-3 shadow-sm shadow-black/15 sm:grid-cols-2 xl:grid-cols-4"
    >
      <div>
        <label
          htmlFor="filter-story-status"
          className="block text-xs font-semibold uppercase tracking-wide text-muted"
        >
          Story status
        </label>
        <select
          id="filter-story-status"
          value={values.storyStatus}
          onChange={(event) => onChange('storyStatus', event.target.value)}
          className="mt-1 w-full min-w-0 rounded-md border bg-surface px-3 py-2 text-sm capitalize transition hover:border-accent/60 focus:ring-2 focus:ring-accent/40"
        >
          <option value="">Any status</option>
          {storyStatuses.map((status) => (
            <option key={status} value={status}>
              {label(status)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label
          htmlFor="filter-priority"
          className="block text-xs font-semibold uppercase tracking-wide text-muted"
        >
          Priority
        </label>
        <select
          id="filter-priority"
          value={values.priority}
          onChange={(event) => onChange('priority', event.target.value)}
          className="mt-1 w-full min-w-0 rounded-md border bg-surface px-3 py-2 text-sm capitalize transition hover:border-accent/60 focus:ring-2 focus:ring-accent/40"
        >
          <option value="">Any priority</option>
          {priorities.map((priority) => (
            <option key={priority} value={priority}>
              {priority}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label
          htmlFor="filter-assignee"
          className="block text-xs font-semibold uppercase tracking-wide text-muted"
        >
          Story assignee
        </label>
        <select
          id="filter-assignee"
          value={values.assignee}
          onChange={(event) => onChange('assignee', event.target.value)}
          className="mt-1 w-full min-w-0 rounded-md border bg-surface px-3 py-2 text-sm transition hover:border-accent/60 focus:ring-2 focus:ring-accent/40"
        >
          <option value="">Any assignee</option>
          <option value="unassigned">Unassigned</option>
          {members.map((member) => (
            <option key={member.id} value={String(member.id)}>
              {member.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label
          htmlFor="filter-task-status"
          className="block text-xs font-semibold uppercase tracking-wide text-muted"
        >
          Task status
        </label>
        <select
          id="filter-task-status"
          value={values.taskStatus}
          onChange={(event) => onChange('taskStatus', event.target.value)}
          className="mt-1 w-full min-w-0 rounded-md border bg-surface px-3 py-2 text-sm capitalize transition hover:border-accent/60 focus:ring-2 focus:ring-accent/40"
        >
          <option value="">Any task status</option>
          {taskStatuses.map((status) => (
            <option key={status} value={status}>
              {label(status)}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center justify-end border-t border-line/70 pt-2 sm:col-span-2 xl:col-span-4">
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold text-muted transition hover:bg-surface hover:text-accent-hover"
        >
          <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5">
            <path d="M4.5 5.5v4h4M5 9a5.5 5.5 0 1 1 .9 4.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Clear filters
        </button>
      </div>
    </section>
  )
}
