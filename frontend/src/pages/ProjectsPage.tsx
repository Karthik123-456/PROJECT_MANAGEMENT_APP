import { useState } from 'react'
import { Link } from 'react-router'
import { ApiError } from '../api/client.ts'
import type { ProjectStatus, ProjectWithRole } from '../api/types.ts'
import { useProjects, PROJECTS_PAGE_SIZE } from '../projects/useProjects.ts'
import { useProjectMutations } from '../projects/useProjectMutations.ts'
import { projectErrorMessage } from '../projects/projectErrors.ts'
import { ConfirmDialog } from '../projects/components/ConfirmDialog.tsx'
import { ProjectFormDialog } from '../projects/components/ProjectFormDialog.tsx'

function ProjectCard({
  project,
  onArchive,
}: {
  project: ProjectWithRole
  onArchive: (project: ProjectWithRole) => void
}) {
  return (
    <li className="group flex min-w-0 flex-col rounded-md border border-line bg-surface p-4 shadow-sm shadow-black/20 transition duration-200 hover:-translate-y-0.5 hover:border-accent/50 hover:bg-surface-hover hover:shadow-md hover:shadow-black/30 sm:p-5">
      <div className="flex min-h-12 items-start justify-between gap-3">
        <h2 className="min-w-0 text-lg font-semibold leading-snug tracking-tight text-ink">
          <Link
            to={`/projects/${project.id}`}
            className="break-words text-ink transition hover:text-accent-hover focus-visible:outline-2 focus-visible:outline-accent"
          >
            {project.name}
          </Link>
        </h2>
        {project.archived_at && (
          <span className="shrink-0 rounded-full bg-status-amber-bg px-2 py-1 text-xs font-semibold uppercase tracking-wide text-status-amber-text ring-1 ring-inset ring-status-amber-line">
            Archived
          </span>
        )}
      </div>
      <p className="line-clamp-2 min-h-10 whitespace-pre-wrap break-words text-sm leading-5 text-secondary">
        {project.description || 'No description'}
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
        <span className="rounded-full bg-accent/15 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-accent-hover ring-1 ring-inset ring-accent/30">
          Your role: {project.role}
        </span>
        {project.role === 'owner' && !project.archived_at && (
          <button
            type="button"
            onClick={() => onArchive(project)}
            aria-label={`Archive ${project.name}`}
            className="rounded-md border border-line px-2.5 py-1.5 text-xs font-medium text-secondary transition hover:bg-surface-hover"
          >
            Archive
          </button>
        )}
        <Link
          to={`/projects/${project.id}`}
          className="rounded-md px-2.5 py-1.5 text-xs font-semibold text-accent-hover transition hover:bg-accent/10"
        >
          Open project
        </Link>
      </div>
    </li>
  )
}

export function ProjectsPage() {
  const [status, setStatus] = useState<ProjectStatus>('active')
  const [offset, setOffset] = useState(0)
  const [createOpen, setCreateOpen] = useState(false)
  const [archiveTarget, setArchiveTarget] = useState<ProjectWithRole | null>(
    null,
  )
  const [actionError, setActionError] = useState('')
  const projectsQuery = useProjects({
    status,
    limit: PROJECTS_PAGE_SIZE,
    offset,
  })
  const mutations = useProjectMutations()

  function changeStatus(next: ProjectStatus) {
    setStatus(next)
    setOffset(0)
  }

  async function createProject(input: { name: string; description?: string | null }) {
    setActionError('')
    await mutations.createProject.mutateAsync(input)
    setCreateOpen(false)
    setStatus('active')
    setOffset(0)
  }

  async function archiveProject() {
    if (!archiveTarget) return
    setActionError('')
    try {
      await mutations.archiveProject.mutateAsync(archiveTarget.id)
      setArchiveTarget(null)
    } catch (error) {
      setActionError(projectErrorMessage(error))
      setArchiveTarget(null)
    }
  }

  const total = projectsQuery.data?.total ?? 0
  const currentPage = Math.floor(offset / PROJECTS_PAGE_SIZE) + 1
  const pageCount = Math.max(1, Math.ceil(total / PROJECTS_PAGE_SIZE))
  const errorMessage =
    projectsQuery.error instanceof ApiError
      ? projectsQuery.error.message
      : 'Could not load projects.'

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            My projects
          </h1>
          <p className="mt-1 text-sm text-secondary">
            Projects you currently belong to.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setActionError('')
            setCreateOpen(true)
          }}
          className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-app shadow-sm transition hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4">
            <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          New project
        </button>
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-md border border-line bg-surface p-1 shadow-sm shadow-black/10">
          {(['active', 'archived'] as const).map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={status === item}
              onClick={() => changeStatus(item)}
              className={`rounded-md px-3 py-2 text-sm capitalize ${
                status === item
                  ? 'bg-accent font-semibold text-app shadow-sm'
                  : 'text-secondary hover:bg-surface-hover'
              }`}
            >
              {item}
            </button>
          ))}
        </div>
        {projectsQuery.data && (
          <p className="text-sm text-secondary">
            {total} {total === 1 ? 'project' : 'projects'}
          </p>
        )}
      </div>

      {actionError && (
        <p
          role="alert"
          aria-live="polite"
          className="mb-4 rounded-md border border-red-400/40 bg-red-950/40 p-3 text-sm text-red-200"
        >
          {actionError}
        </p>
      )}

      {projectsQuery.isPending && (
        <p role="status" className="rounded-md border border-line bg-surface p-6 text-center text-sm text-muted shadow-sm">
          Loading projects…
        </p>
      )}

      {projectsQuery.error && (
        <div className="rounded-md border border-red-400/40 bg-red-950/40 p-5 shadow-sm">
          <p className="font-medium text-red-200">{errorMessage}</p>
          <button
            type="button"
            onClick={() => void projectsQuery.refetch()}
            disabled={projectsQuery.isFetching}
            className="mt-3 rounded-md border border-red-300/50 px-3 py-2 text-sm font-semibold text-red-200 hover:bg-red-900/40 disabled:opacity-60"
          >
            {projectsQuery.isFetching ? 'Retrying…' : 'Retry'}
          </button>
        </div>
      )}

      {!projectsQuery.isPending &&
        !projectsQuery.error &&
        projectsQuery.data?.data.length === 0 && (
          <div className="rounded-md border border-dashed border-line bg-surface p-10 text-center shadow-sm shadow-black/20">
            <h2 className="text-lg font-semibold text-ink">
              {status === 'active' ? 'No active projects yet' : 'No archived projects'}
            </h2>
            <p className="mt-2 text-sm text-muted">
              {status === 'active'
                ? 'Create a project or ask to be added to one.'
                : 'Archived projects will appear here.'}
            </p>
            {status === 'active' && (
              <button
                type="button"
                onClick={() => {
                  setActionError('')
                  setCreateOpen(true)
                }}
                className="mt-5 inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-app transition hover:bg-accent-hover"
              >
                <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4">
                  <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
                New project
              </button>
            )}
          </div>
        )}

      {projectsQuery.data && projectsQuery.data.data.length > 0 && (
        <>
          <ul className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projectsQuery.data.data.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onArchive={(target) => {
                  setActionError('')
                  setArchiveTarget(target)
                }}
              />
            ))}
          </ul>
          <div className="mt-6 flex items-center justify-between gap-4">
            <button
              type="button"
              disabled={offset === 0 || projectsQuery.isFetching}
              onClick={() =>
                setOffset((current) =>
                  Math.max(0, current - PROJECTS_PAGE_SIZE),
                )
              }
              className="rounded-md border border-line px-3 py-2 text-sm font-semibold text-secondary transition hover:bg-surface-hover disabled:opacity-50"
            >
              Previous
            </button>
            <p aria-live="polite" className="text-sm text-muted">
              Page {currentPage} of {pageCount}
            </p>
            <button
              type="button"
              disabled={
                offset + PROJECTS_PAGE_SIZE >= total ||
                projectsQuery.isFetching
              }
              onClick={() => setOffset((current) => current + PROJECTS_PAGE_SIZE)}
              className="rounded-md border border-line px-3 py-2 text-sm font-semibold text-secondary transition hover:bg-surface-hover disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </>
      )}

      {createOpen && (
        <ProjectFormDialog
          open
          saving={mutations.createProject.isPending}
          onClose={() => setCreateOpen(false)}
          onSubmit={createProject}
        />
      )}
      <ConfirmDialog
        open={archiveTarget !== null}
        title="Archive project?"
        message={`“${archiveTarget?.name ?? ''}” will become read-only until it is restored.`}
        confirmLabel="Archive project"
        pending={mutations.archiveProject.isPending}
        onClose={() => setArchiveTarget(null)}
        onConfirm={() => void archiveProject()}
      />
    </section>
  )
}
