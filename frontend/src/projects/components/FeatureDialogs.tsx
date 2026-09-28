import { useState, type FormEvent } from 'react'
import { ApiError } from '../../api/client.ts'
import type {
  Member,
  StoryInput,
  StoryPriority,
  StoryStatus,
  StoryTree,
  TaskInput,
  TaskStatus,
} from '../../api/types.ts'
import { NativeDialog } from '../../components/NativeDialog.tsx'
import { projectErrorMessage } from '../projectErrors.ts'

type FieldName =
  | 'title'
  | 'description'
  | 'acceptance_criteria'
  | 'priority'
  | 'story_points'
  | 'assignee_id'
  | 'status'
  | 'estimate_hours'
  | 'due_date'

type FieldErrors = Partial<Record<FieldName, string>>

interface SharedProps {
  open: boolean
  onClose: () => void
  members: Member[]
  saving: boolean
}

interface StoryFormDialogProps extends SharedProps {
  story?: StoryTree
  onSubmit: (input: StoryInput) => Promise<void>
}

interface TaskFormDialogProps extends SharedProps {
  task?: StoryTree['tasks'][number]
  onSubmit: (input: TaskInput) => Promise<void>
}

const inputClassName =
  'mt-1 block w-full rounded-md border border-line bg-surface px-3 py-2 text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/40'
const statuses: StoryStatus[] = ['backlog', 'in_progress', 'in_review', 'done']
const priorities: StoryPriority[] = ['low', 'medium', 'high']
const taskStatuses: TaskStatus[] = ['todo', 'in_progress', 'done']

function statusLabel(value: string): string {
  return value.replaceAll('_', ' ')
}

function serverFieldName(path: string | Array<string | number>): FieldName | undefined {
  const field = (typeof path === 'string' ? path.split('.') : path).at(-1)
  return field === 'title' ||
    field === 'description' ||
    field === 'acceptance_criteria' ||
    field === 'priority' ||
    field === 'story_points' ||
    field === 'assignee_id' ||
    field === 'status' ||
    field === 'estimate_hours' ||
    field === 'due_date'
    ? field
    : undefined
}

function isRealDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  if (year === undefined || month === undefined || day === undefined) return false
  const date = new Date(0)
  date.setUTCHours(0, 0, 0, 0)
  date.setUTCFullYear(year, month - 1, day)
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

function isOptionalNumber(value: string): boolean {
  return value === '' || (Number.isFinite(Number(value)) && Number(value) >= 0)
}

function setServerErrors(
  error: unknown,
  setFieldErrors: (errors: FieldErrors) => void,
  setGeneralError: (message: string) => void,
) {
  if (error instanceof ApiError && error.status === 422 && error.details) {
    const errors: FieldErrors = {}
    let hasUnmappedError = false
    for (const detail of error.details) {
      const field = serverFieldName(detail.path)
      if (field) errors[field] = detail.message
      else hasUnmappedError = true
    }
    setFieldErrors(errors)
    if (hasUnmappedError || Object.keys(errors).length === 0) {
      setGeneralError(error.message)
    }
    return
  }

  setGeneralError(projectErrorMessage(error))
}

function ErrorText({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} className="mt-1 text-sm text-red-300">
      {message}
    </p>
  ) : null
}

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: string }) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-xs font-semibold text-secondary"
    >
      {children}
    </label>
  )
}

function AssigneeSelect({
  value,
  members,
  error,
  onChange,
}: {
  value: string
  members: Member[]
  error?: string
  onChange: (value: string) => void
}) {
  return (
    <div>
      <FieldLabel htmlFor="assignee_id">Assignee</FieldLabel>
      <select
        id="assignee_id"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? 'assignee_id-error' : undefined}
        className={inputClassName}
      >
        <option value="">Unassigned</option>
        {members.map((member) => (
          <option key={member.id} value={member.id}>
            {member.name} ({member.email})
          </option>
        ))}
      </select>
      <ErrorText id="assignee_id-error" message={error} />
    </div>
  )
}

function DialogActions({
  saving,
  submitText,
  onClose,
}: {
  saving: boolean
  submitText: string
  onClose: () => void
}) {
  return (
    <div className="flex flex-wrap justify-end gap-3 border-t border-line pt-4">
      <button
        type="button"
        onClick={onClose}
        className="rounded-md border border-line px-4 py-2 text-sm font-semibold text-secondary transition hover:bg-surface-hover"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={saving}
        className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-app transition hover:bg-accent-hover disabled:opacity-60"
      >
        {saving ? 'Saving…' : submitText}
      </button>
    </div>
  )
}

export function StoryFormDialog({
  open,
  onClose,
  members,
  saving,
  story,
  onSubmit,
}: StoryFormDialogProps) {
  const [title, setTitle] = useState(story?.title ?? '')
  const [description, setDescription] = useState(story?.description ?? '')
  const [criteria, setCriteria] = useState(story?.acceptance_criteria ?? '')
  const [status, setStatus] = useState<StoryStatus>(
    story?.status ?? 'backlog',
  )
  const [priority, setPriority] = useState<StoryPriority>(
    story?.priority ?? 'medium',
  )
  const [points, setPoints] = useState(
    story?.story_points == null ? '' : String(story.story_points),
  )
  const [assigneeId, setAssigneeId] = useState(
    story?.assignee_id == null ? '' : String(story.assignee_id),
  )
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [generalError, setGeneralError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const errors: FieldErrors = {}
    if (title.trim().length < 1 || title.trim().length > 200) {
      errors.title = 'Title must be between 1 and 200 characters.'
    }
    if (description.length > 5000) {
      errors.description = 'Description must be at most 5000 characters.'
    }
    if (criteria.length > 5000) {
      errors.acceptance_criteria =
        'Acceptance criteria must be at most 5000 characters.'
    }
    if (
      points !== '' &&
      (!Number.isInteger(Number(points)) ||
        Number(points) < 0 ||
        Number(points) > 100)
    ) {
      errors.story_points = 'Story points must be an integer from 0 to 100.'
    }
    setFieldErrors(errors)
    setGeneralError('')
    if (Object.keys(errors).length > 0) return

    try {
      await onSubmit({
        title: title.trim(),
        description: description || null,
        acceptance_criteria: criteria || null,
        status,
        priority,
        story_points: points === '' ? null : Number(points),
        assignee_id: assigneeId === '' ? null : Number(assigneeId),
      })
      onClose()
    } catch (error) {
      setServerErrors(error, setFieldErrors, setGeneralError)
    }
  }

  const errorProps = (field: FieldName) => ({
    'aria-invalid': Boolean(fieldErrors[field]),
    'aria-describedby': fieldErrors[field] ? `${field}-error` : undefined,
  })

  return (
    <NativeDialog
      open={open}
      onClose={onClose}
      title={story ? 'Edit story' : 'New story'}
      labelledBy="story-dialog-title"
    >
      <form noValidate onSubmit={submit} className="space-y-4">
        {generalError && <p role="alert" aria-live="polite" className="text-sm text-red-300">{generalError}</p>}
        <div>
          <FieldLabel htmlFor="title">Title</FieldLabel>
          <input id="title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} {...errorProps('title')} className={inputClassName} />
          <ErrorText id="title-error" message={fieldErrors.title} />
        </div>
        <div>
          <FieldLabel htmlFor="description">Description</FieldLabel>
          <textarea id="description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={5000} {...errorProps('description')} className={inputClassName} rows={3} />
          <ErrorText id="description-error" message={fieldErrors.description} />
        </div>
        <div>
          <FieldLabel htmlFor="acceptance_criteria">Acceptance criteria</FieldLabel>
          <textarea id="acceptance_criteria" value={criteria} onChange={(event) => setCriteria(event.target.value)} maxLength={5000} {...errorProps('acceptance_criteria')} className={inputClassName} rows={3} />
          <ErrorText id="acceptance_criteria-error" message={fieldErrors.acceptance_criteria} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="story-status">Status</FieldLabel>
            <select id="story-status" value={status} onChange={(event) => setStatus(event.target.value as StoryStatus)} className={inputClassName}>
              {statuses.map((item) => <option key={item} value={item}>{statusLabel(item)}</option>)}
            </select>
          </div>
          <div>
            <FieldLabel htmlFor="priority">Priority</FieldLabel>
            <select id="priority" value={priority} onChange={(event) => setPriority(event.target.value as StoryPriority)} className={inputClassName}>
              {priorities.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
        </div>
        <div>
          <FieldLabel htmlFor="story_points">Story points</FieldLabel>
          <input id="story_points" type="number" min={0} max={100} step={1} value={points} onChange={(event) => setPoints(event.target.value)} {...errorProps('story_points')} className={inputClassName} />
          <ErrorText id="story_points-error" message={fieldErrors.story_points} />
        </div>
        <AssigneeSelect value={assigneeId} members={members} error={fieldErrors.assignee_id} onChange={setAssigneeId} />
        <DialogActions saving={saving} submitText={story ? 'Save story' : 'Create story'} onClose={onClose} />
      </form>
    </NativeDialog>
  )
}

export function TaskFormDialog({
  open,
  onClose,
  members,
  saving,
  task,
  onSubmit,
}: TaskFormDialogProps) {
  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? 'todo')
  const [assigneeId, setAssigneeId] = useState(
    task?.assignee_id == null ? '' : String(task.assignee_id),
  )
  const [estimate, setEstimate] = useState(
    task?.estimate_hours == null ? '' : String(task.estimate_hours),
  )
  const [dueDate, setDueDate] = useState(task?.due_date ?? '')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [generalError, setGeneralError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const errors: FieldErrors = {}
    if (title.trim().length < 1 || title.trim().length > 200) {
      errors.title = 'Title must be between 1 and 200 characters.'
    }
    if (description.length > 5000) {
      errors.description = 'Description must be at most 5000 characters.'
    }
    if (!isOptionalNumber(estimate)) {
      errors.estimate_hours = 'Estimate must be a non-negative number or empty.'
    }
    if (dueDate !== '' && !isRealDate(dueDate)) {
      errors.due_date = 'Enter a real date in YYYY-MM-DD format.'
    }
    setFieldErrors(errors)
    setGeneralError('')
    if (Object.keys(errors).length > 0) return

    try {
      await onSubmit({
        title: title.trim(),
        description: description || null,
        status,
        assignee_id: assigneeId === '' ? null : Number(assigneeId),
        estimate_hours: estimate === '' ? null : Number(estimate),
        due_date: dueDate || null,
      })
      onClose()
    } catch (error) {
      setServerErrors(error, setFieldErrors, setGeneralError)
    }
  }

  const errorProps = (field: FieldName) => ({
    'aria-invalid': Boolean(fieldErrors[field]),
    'aria-describedby': fieldErrors[field] ? `${field}-error` : undefined,
  })

  return (
    <NativeDialog
      open={open}
      onClose={onClose}
      title={task ? 'Edit task' : 'New task'}
      labelledBy="task-dialog-title"
    >
      <form noValidate onSubmit={submit} className="space-y-4">
        {generalError && <p role="alert" aria-live="polite" className="text-sm text-red-300">{generalError}</p>}
        <div>
          <FieldLabel htmlFor="title">Title</FieldLabel>
          <input id="title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} {...errorProps('title')} className={inputClassName} />
          <ErrorText id="title-error" message={fieldErrors.title} />
        </div>
        <div>
          <FieldLabel htmlFor="description">Description</FieldLabel>
          <textarea id="description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={5000} {...errorProps('description')} className={inputClassName} rows={3} />
          <ErrorText id="description-error" message={fieldErrors.description} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="task-status">Status</FieldLabel>
            <select id="task-status" value={status} onChange={(event) => setStatus(event.target.value as TaskStatus)} className={inputClassName}>
              {taskStatuses.map((item) => <option key={item} value={item}>{statusLabel(item)}</option>)}
            </select>
          </div>
          <div>
            <FieldLabel htmlFor="estimate_hours">Estimate hours</FieldLabel>
            <input id="estimate_hours" type="number" min={0} step="any" value={estimate} onChange={(event) => setEstimate(event.target.value)} {...errorProps('estimate_hours')} className={inputClassName} />
            <ErrorText id="estimate_hours-error" message={fieldErrors.estimate_hours} />
          </div>
        </div>
        <div>
          <FieldLabel htmlFor="due_date">Due date</FieldLabel>
          <input id="due_date" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} {...errorProps('due_date')} className={inputClassName} />
          <ErrorText id="due_date-error" message={fieldErrors.due_date} />
        </div>
        <AssigneeSelect value={assigneeId} members={members} error={fieldErrors.assignee_id} onChange={setAssigneeId} />
        <DialogActions saving={saving} submitText={task ? 'Save task' : 'Create task'} onClose={onClose} />
      </form>
    </NativeDialog>
  )
}
