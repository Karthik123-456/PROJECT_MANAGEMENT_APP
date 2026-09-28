import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { ApiError } from '../api/client.ts'
import type {
  Member,
  ProjectRole,
  StoryPriority,
  StoryStatus,
  StoryTree,
  TaskStatus,
} from '../api/types.ts'
import { NotFoundPage } from './NotFoundPage.tsx'
import { ConfirmDialog } from '../projects/components/ConfirmDialog.tsx'
import {
  StoryFormDialog,
  TaskFormDialog,
} from '../projects/components/FeatureDialogs.tsx'
import { MembersPanel } from '../projects/components/MembersPanel.tsx'
import { ProjectFilters, type FilterValues } from '../projects/components/ProjectFilters.tsx'
import { StoryCard } from '../projects/components/StoryCard.tsx'
import { projectErrorMessage } from '../projects/projectErrors.ts'
import { useProjectMutations } from '../projects/useProjectMutations.ts'
import { useProject, useProjectTree } from '../projects/useProjectTree.ts'
import { useStoryMutations } from '../projects/useStoryMutations.ts'
import { useMembers } from '../projects/useMembers.ts'
import { useTaskMutations } from '../projects/useTaskMutations.ts'
import { utcToday } from '../projects/utcDate.ts'

type DeleteTarget =
  | { kind: 'story'; story: StoryTree }
  | { kind: 'task'; task: StoryTree['tasks'][number] }
  | null

const VALID_STORY_STATUSES: StoryStatus[] = [
  'backlog',
  'in_progress',
  'in_review',
  'done',
]
const VALID_PRIORITIES: StoryPriority[] = ['low', 'medium', 'high']
const VALID_TASK_STATUSES: TaskStatus[] = ['todo', 'in_progress', 'done']

function readFilter(
  params: URLSearchParams,
  key: string,
  allowed: readonly string[],
): string {
  const value = params.get(key) ?? ''
  return value === '' || allowed.includes(value) ? value : ''
}

function readAssignee(params: URLSearchParams): string {
  const value = params.get('assignee') ?? ''
  return value === 'unassigned' || /^\d+$/.test(value) ? value : ''
}

function filteredStories(
  stories: StoryTree[],
  values: FilterValues,
): StoryTree[] {
  return stories
    .filter((story) => {
      if (values.storyStatus && story.status !== values.storyStatus) return false
      if (values.priority && story.priority !== values.priority) return false
      if (
        values.assignee === 'unassigned' &&
        story.assignee_id !== null
      ) {
        return false
      }
      if (
        values.assignee !== '' &&
        values.assignee !== 'unassigned' &&
        story.assignee_id !== Number(values.assignee)
      ) {
        return false
      }
      return true
    })
    .map((story) =>
      values.taskStatus
        ? {
            ...story,
            tasks: story.tasks.filter(
              (task) => task.status === values.taskStatus,
            ),
          }
        : story,
    )
}

function projectQueryError(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : 'Could not load this project. Please try again.'
}

export function ProjectDetailPage() {
  const { id: idParam } = useParams()
  const projectId = Number(idParam)
  const validId = Number.isSafeInteger(projectId) && projectId > 0
  const projectQuery = useProject(validId ? projectId : 0)
  const treeQuery = useProjectTree(validId ? projectId : 0)
  const membersQuery = useMembers(validId ? projectId : 0)
  const [searchParams, setSearchParams] = useSearchParams()
  const [storyDialog, setStoryDialog] = useState<
    { story: StoryTree | null } | null
  >(null)
  const [taskDialog, setTaskDialog] = useState<{
    storyId: number
    task: StoryTree['tasks'][number] | null
  } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [actionError, setActionError] = useState('')

  const storyMutations = useStoryMutations(validId ? projectId : 0)
  const taskMutations = useTaskMutations(validId ? projectId : 0)
  const projectMutations = useProjectMutations()
  const today = utcToday()

  const filters: FilterValues = {
    storyStatus: readFilter(searchParams, 'storyStatus', VALID_STORY_STATUSES),
    priority: readFilter(searchParams, 'priority', VALID_PRIORITIES),
    assignee: readAssignee(searchParams),
    taskStatus: readFilter(searchParams, 'taskStatus', VALID_TASK_STATUSES),
  }

  const stories = filteredStories(treeQuery.data?.stories ?? [], filters)

  if (!validId) {
    return <NotFoundPage />
  }

  const hasNotFound =
    (projectQuery.error instanceof ApiError &&
      projectQuery.error.status === 404) ||
    (treeQuery.error instanceof ApiError && treeQuery.error.status === 404)
  if (hasNotFound) {
    return <NotFoundPage />
  }

  if (
    projectQuery.isPending ||
    treeQuery.isPending ||
    !projectQuery.data ||
    !treeQuery.data
  ) {
    if (projectQuery.error || treeQuery.error) {
      const error = projectQuery.error ?? treeQuery.error
      return (
        <section className="rounded-md border border-red-400/40 bg-red-950/40 p-5 shadow-sm">
          <h1 className="font-semibold text-red-200">Could not load project</h1>
          <p role="alert" className="mt-1 text-sm text-red-200">
            {projectQueryError(error)}
          </p>
          <div className="mt-3 flex gap-3">
            <button
              type="button"
              onClick={() => {
                void projectQuery.refetch()
                void treeQuery.refetch()
              }}
              className="rounded-md border border-red-300/50 px-3 py-2 text-sm font-semibold text-red-200 transition hover:bg-red-900/40"
            >
              Retry
            </button>
            <Link to="/projects" className="px-3 py-2 text-sm font-semibold text-accent-hover underline">
              Back to projects
            </Link>
          </div>
        </section>
      )
    }
    return (
      <p role="status" className="rounded-md border border-line bg-surface p-8 text-center text-sm text-muted shadow-sm shadow-black/20">
        Loading project…
      </p>
    )
  }

  const project = projectQuery.data.project
  const role: ProjectRole = project.role
  const archived = project.archived_at !== null
  const members: Member[] = membersQuery.data?.data ?? []
  const canWrite = !archived && role !== 'viewer'

  function changeFilter(key: keyof FilterValues, value: string) {
    const next = new URLSearchParams(searchParams)
    const parameter =
      key === 'storyStatus'
        ? 'storyStatus'
        : key === 'taskStatus'
          ? 'taskStatus'
          : key
    if (value) next.set(parameter, value)
    else next.delete(parameter)
    setSearchParams(next, { replace: true })
  }

  function clearFilters() {
    const next = new URLSearchParams(searchParams)
    for (const key of ['storyStatus', 'priority', 'assignee', 'taskStatus']) {
      next.delete(key)
    }
    setSearchParams(next, { replace: true })
  }

  async function submitStory(input: Parameters<typeof storyMutations.createStory.mutateAsync>[0]) {
    if (storyDialog?.story) {
      await storyMutations.updateStory.mutateAsync({
        id: storyDialog.story.id,
        patch: input,
      })
    } else {
      await storyMutations.createStory.mutateAsync(input)
    }
    setStoryDialog(null)
  }

  async function submitTask(input: Parameters<typeof taskMutations.createTask.mutateAsync>[0]['input']) {
    if (!taskDialog) return
    if (taskDialog.task) {
      await taskMutations.updateTask.mutateAsync({
        id: taskDialog.task.id,
        patch: input,
      })
    } else {
      await taskMutations.createTask.mutateAsync({
        storyId: taskDialog.storyId,
        input,
      })
    }
    setTaskDialog(null)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setActionError('')
    try {
      if (deleteTarget.kind === 'story') {
        await storyMutations.deleteStory.mutateAsync(deleteTarget.story.id)
      } else {
        await taskMutations.deleteTask.mutateAsync(deleteTarget.task.id)
      }
      setDeleteTarget(null)
    } catch (error) {
      setActionError(projectErrorMessage(error))
      setDeleteTarget(null)
    }
  }

  async function archiveProject() {
    try {
      await projectMutations.archiveProject.mutateAsync(projectId)
      setArchiveOpen(false)
    } catch (error) {
      setActionError(projectErrorMessage(error))
      setArchiveOpen(false)
    }
  }

  async function restoreProject() {
    try {
      await projectMutations.restoreProject.mutateAsync(projectId)
      setActionError('')
    } catch (error) {
      setActionError(projectErrorMessage(error))
    }
  }

  return (
    <section className="min-w-0">
      <div className="mb-5">
        <Link
          to="/projects"
          className="inline-flex items-center gap-2 text-sm font-semibold text-accent-hover transition hover:text-accent"
        >
          <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4">
            <path d="M12.5 4.5 7 10l5.5 5.5M7.5 10H17" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Projects
        </Link>
      </div>

      <header className="mb-6 rounded-md border border-line bg-surface p-5 shadow-sm shadow-black/20 sm:p-6">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="break-words text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                {project.name}
              </h1>
              {archived && (
                <span className="rounded-full bg-status-amber-bg px-2.5 py-1 text-xs font-semibold text-status-amber-text ring-1 ring-inset ring-status-amber-line">
                  Archived
                </span>
              )}
            </div>
            {project.description && (
              <p className="mt-2 whitespace-pre-wrap break-words text-sm text-secondary">
                {project.description}
              </p>
            )}
            <p className="mt-3 inline-flex rounded-full bg-accent/15 px-2.5 py-1 text-xs font-semibold text-accent-hover ring-1 ring-inset ring-accent/30">
              Your role: <span className="ml-1 capitalize">{role}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {archived && role === 'owner' && (
              <button
                type="button"
                onClick={() => void restoreProject()}
                disabled={projectMutations.restoreProject.isPending}
                className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-app shadow-sm transition hover:bg-accent-hover disabled:opacity-60"
              >
                {projectMutations.restoreProject.isPending ? 'Restoring…' : 'Restore project'}
              </button>
            )}
            {!archived && role === 'owner' && (
              <button
                type="button"
                onClick={() => setArchiveOpen(true)}
                className="rounded-md border border-line bg-transparent px-3 py-2 text-sm font-semibold text-secondary transition hover:bg-surface-hover"
              >
                Archive project
              </button>
            )}
          </div>
        </div>
        {archived && (
          <p className="mt-4 rounded-md border border-status-amber-line/50 bg-status-amber-bg/15 px-3 py-2 text-sm text-amber-100">
            This project is archived and read-only.
            {role === 'owner' ? ' Restore it to make changes.' : ''}
          </p>
        )}
      </header>

      {actionError && (
        <p role="alert" aria-live="polite" className="mb-4 rounded-md border border-red-400/40 bg-red-950/40 p-3 text-sm text-red-200">
          {actionError}
        </p>
      )}

      <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold tracking-tight text-ink">Stories</h2>
            {canWrite && (
              <button
                type="button"
                onClick={() => setStoryDialog({ story: null })}
                className="inline-flex items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-semibold text-app shadow-sm transition hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4">
                  <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
                New story
              </button>
            )}
          </div>

          <ProjectFilters
            values={filters}
            members={members}
            onChange={changeFilter}
            onReset={clearFilters}
          />

          {treeQuery.data.stories.length === 0 ? (
            <div className="rounded-md border border-dashed border-line bg-surface p-10 text-center shadow-sm shadow-black/20">
              <h3 className="text-base font-semibold text-ink">No stories yet</h3>
              <p className="mt-2 text-sm text-muted">
                {canWrite
                  ? 'Create a story to start organizing project work.'
                  : 'Stories will appear here when they are added.'}
              </p>
            </div>
          ) : stories.length === 0 ? (
            <p className="rounded-md border border-line bg-surface px-5 py-10 text-center text-sm text-muted shadow-sm shadow-black/20">
              No stories match these filters.{' '}
              <button
                type="button"
                onClick={clearFilters}
                className="ml-1 font-semibold text-accent-hover underline-offset-2 hover:underline"
              >
                Clear filters
              </button>
            </p>
          ) : (
            <div className="min-w-0 space-y-3">
              {stories.map((story) => (
                <StoryCard
                  key={story.id}
                  story={story}
                  role={role}
                  archived={archived}
                  statusPending={
                    storyMutations.changeStoryStatus.isPending ||
                    taskMutations.changeTaskStatus.isPending
                  }
                  today={today}
                  onStoryStatus={(id, status) =>
                    storyMutations.changeStoryStatus
                      .mutateAsync({ id, status })
                      .then(() => undefined)
                  }
                  onTaskStatus={(id, status) =>
                    taskMutations.changeTaskStatus
                      .mutateAsync({ id, status })
                      .then(() => undefined)
                  }
                  onEditStory={(item) => setStoryDialog({ story: item })}
                  onDeleteStory={(item) =>
                    setDeleteTarget({ kind: 'story', story: item })
                  }
                  onAddTask={(storyId) =>
                    setTaskDialog({ storyId, task: null })
                  }
                  onEditTask={(storyId, task) =>
                    setTaskDialog({ storyId, task })
                  }
                  onDeleteTask={(task) =>
                    setDeleteTarget({ kind: 'task', task })
                  }
                />
              ))}
            </div>
          )}
        </div>

        <MembersPanel
          projectId={projectId}
          role={role}
          archived={archived}
        />
      </div>

      {storyDialog && (
        <StoryFormDialog
          open
          story={storyDialog.story ?? undefined}
          members={members}
          saving={
            storyMutations.createStory.isPending ||
            storyMutations.updateStory.isPending
          }
          onClose={() => setStoryDialog(null)}
          onSubmit={submitStory}
        />
      )}
      {taskDialog && (
        <TaskFormDialog
          open
          task={taskDialog.task ?? undefined}
          members={members}
          saving={
            taskMutations.createTask.isPending ||
            taskMutations.updateTask.isPending
          }
          onClose={() => setTaskDialog(null)}
          onSubmit={submitTask}
        />
      )}
      <ConfirmDialog
        open={deleteTarget !== null}
        title={deleteTarget?.kind === 'story' ? 'Delete story?' : 'Delete task?'}
        message={
          deleteTarget?.kind === 'story'
            ? `Delete “${deleteTarget.story.title}” and all its tasks? This cannot be undone.`
            : `Delete “${deleteTarget?.kind === 'task' ? deleteTarget.task.title : ''}”? This cannot be undone.`
        }
        confirmLabel="Delete"
        pending={
          storyMutations.deleteStory.isPending ||
          taskMutations.deleteTask.isPending
        }
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />
      <ConfirmDialog
        open={archiveOpen}
        title="Archive project?"
        message="The project will be read-only until restored."
        confirmLabel="Archive project"
        pending={projectMutations.archiveProject.isPending}
        onClose={() => setArchiveOpen(false)}
        onConfirm={() => void archiveProject()}
      />
    </section>
  )
}
