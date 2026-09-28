import { useState, type FormEvent } from 'react'
import { ApiError } from '../../api/client.ts'
import type { ProjectInput } from '../../api/types.ts'
import { NativeDialog } from '../../components/NativeDialog.tsx'

interface ProjectFormDialogProps {
  open: boolean
  saving: boolean
  onClose: () => void
  onSubmit: (input: ProjectInput) => Promise<void>
}

export function ProjectFormDialog({
  open,
  saving,
  onClose,
  onSubmit,
}: ProjectFormDialogProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [nameError, setNameError] = useState('')
  const [descriptionError, setDescriptionError] = useState('')
  const [generalError, setGeneralError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalizedName = name.trim()
    setNameError(
      normalizedName.length < 1 || normalizedName.length > 100
        ? 'Project name must be between 1 and 100 characters.'
        : '',
    )
    setDescriptionError(
      description.length > 5000
        ? 'Description must be at most 5000 characters.'
        : '',
    )
    setGeneralError('')
    if (
      normalizedName.length < 1 ||
      normalizedName.length > 100 ||
      description.length > 5000
    ) {
      return
    }

    try {
      await onSubmit({
        name: normalizedName,
        description: description || null,
      })
      onClose()
    } catch (error) {
      if (error instanceof ApiError && error.status === 422 && error.details) {
        let hasMappedError = false
        for (const detail of error.details) {
          const path =
            typeof detail.path === 'string'
              ? detail.path
              : detail.path.join('.')
          if (path === 'name') {
            setNameError(detail.message)
            hasMappedError = true
          } else if (path === 'description') {
            setDescriptionError(detail.message)
            hasMappedError = true
          }
        }
        if (!hasMappedError) setGeneralError(error.message)
      } else {
        setGeneralError(
          error instanceof Error
            ? error.message
            : 'Unable to create the project.',
        )
      }
    }
  }

  return (
    <NativeDialog
      open={open}
      onClose={onClose}
      title="Create a project"
      labelledBy="project-dialog-title"
    >
      <form noValidate onSubmit={submit} className="space-y-4">
        {generalError && (
          <p role="alert" aria-live="polite" className="text-sm text-red-300">
            {generalError}
          </p>
        )}
        <div>
          <label
            htmlFor="project-name"
            className="block text-xs font-semibold text-secondary"
          >
            Project name
          </label>
          <input
            id="project-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-invalid={Boolean(nameError)}
            aria-describedby={nameError ? 'project-name-error' : undefined}
            className="mt-1 block w-full rounded-md border border-line bg-surface px-3 py-2 text-ink focus:border-accent focus:ring-2 focus:ring-accent/40"
          />
          {nameError && (
            <p id="project-name-error" className="mt-1 text-sm text-red-300">
              {nameError}
            </p>
          )}
        </div>
        <div>
          <label
            htmlFor="project-description"
            className="block text-xs font-semibold text-secondary"
          >
            Description
          </label>
          <textarea
            id="project-description"
            rows={4}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            aria-invalid={Boolean(descriptionError)}
            aria-describedby={
              descriptionError ? 'project-description-error' : undefined
            }
            className="mt-1 block w-full rounded-md border border-line bg-surface px-3 py-2 text-ink focus:border-accent focus:ring-2 focus:ring-accent/40"
          />
          {descriptionError && (
            <p
              id="project-description-error"
              className="mt-1 text-sm text-red-300"
            >
              {descriptionError}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-3 border-t border-line pt-4">
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
            {saving ? 'Creating…' : 'Create project'}
          </button>
        </div>
      </form>
    </NativeDialog>
  )
}
