import { useState, type FormEvent } from 'react'
import { ApiError } from '../../api/client.ts'
import type { Member, MemberRole, ProjectRole } from '../../api/types.ts'
import { useMemberMutations, useMembers } from '../useMembers.ts'
import { projectErrorMessage } from '../projectErrors.ts'
import { ConfirmDialog } from './ConfirmDialog.tsx'

interface MembersPanelProps {
  projectId: number
  role: ProjectRole
  archived: boolean
}

export function MembersPanel({
  projectId,
  role,
  archived,
}: MembersPanelProps) {
  const query = useMembers(projectId)
  const mutations = useMemberMutations(projectId)
  const [email, setEmail] = useState('')
  const [memberRole, setMemberRole] = useState<MemberRole>('member')
  const [emailError, setEmailError] = useState('')
  const [generalError, setGeneralError] = useState('')
  const [removeTarget, setRemoveTarget] = useState<Member | null>(null)
  const [removing, setRemoving] = useState(false)
  const canManage = role === 'owner' && !archived

  async function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalizedEmail = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setEmailError('Enter a valid email address.')
      return
    }

    setEmailError('')
    setGeneralError('')
    try {
      await mutations.addMember.mutateAsync({
        email: normalizedEmail,
        role: memberRole,
      })
      setEmail('')
    } catch (error) {
      if (error instanceof ApiError && error.code === 'USER_NOT_FOUND') {
        setEmailError('No account was found with that email.')
      } else if (error instanceof ApiError && error.code === 'ALREADY_MEMBER') {
        setEmailError('This person is already a project member.')
      } else {
        setGeneralError(projectErrorMessage(error))
      }
    }
  }

  async function changeRole(userId: number, nextRole: MemberRole) {
    setGeneralError('')
    try {
      await mutations.changeMemberRole.mutateAsync({ userId, role: nextRole })
    } catch (error) {
      setGeneralError(projectErrorMessage(error))
    }
  }

  async function removeMember() {
    if (!removeTarget) return
    setRemoving(true)
    setGeneralError('')
    try {
      await mutations.removeMember.mutateAsync(removeTarget.id)
      setRemoveTarget(null)
    } catch (error) {
      setGeneralError(projectErrorMessage(error))
      setRemoveTarget(null)
    } finally {
      setRemoving(false)
    }
  }

  return (
    <aside
      aria-labelledby="members-heading"
      className="min-w-0 rounded-md border border-line bg-surface p-4 shadow-sm shadow-black/20 sm:p-5"
    >
      <h2 id="members-heading" className="text-lg font-bold text-ink">
        Members
      </h2>
      {generalError && (
        <p role="alert" aria-live="polite" className="mt-3 text-sm text-red-300">
          {generalError}
        </p>
      )}

      {query.isPending && (
        <p role="status" className="mt-3 rounded-md bg-surface-hover/60 p-3 text-sm text-muted">
          Loading members…
        </p>
      )}
      {query.error && (
        <div className="mt-3 rounded-md border border-red-400/40 bg-red-950/40 p-3">
          <p className="text-sm text-red-200">Could not load project members.</p>
          <button
            type="button"
            onClick={() => void query.refetch()}
            disabled={query.isFetching}
            className="mt-2 text-sm font-semibold text-red-200 underline disabled:opacity-60"
          >
            {query.isFetching ? 'Retrying…' : 'Retry'}
          </button>
        </div>
      )}
      {query.data && query.data.data.length === 0 && (
        <p className="mt-3 text-sm text-muted">No members found.</p>
      )}
      {query.data && query.data.data.length > 0 && (
        <ul className="mt-3 divide-y divide-line">
          {query.data.data.map((member) => (
            <li
              key={member.id}
              className="flex min-w-0 flex-wrap items-center justify-between gap-2 py-3 first:pt-0"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">
                  {member.name}
                  {member.role === 'owner' && (
                    <span className="ml-2 text-xs text-muted">(Owner)</span>
                  )}
                </p>
                <p className="truncate text-xs text-secondary">{member.email}</p>
              </div>
              <div className="flex items-center gap-2">
                {canManage && member.role !== 'owner' ? (
                  <>
                    <label className="sr-only" htmlFor={`member-role-${member.id}`}>
                      Role for {member.name}
                    </label>
                    <select
                      id={`member-role-${member.id}`}
                      value={member.role}
                      onChange={(event) =>
                        void changeRole(
                          member.id,
                          event.target.value as MemberRole,
                        )
                      }
                      aria-label={`Role for ${member.name}`}
                      className="max-w-28 rounded-md border border-line bg-surface px-2 py-1 text-xs text-ink"
                    >
                      <option value="member">Member</option>
                      <option value="viewer">Viewer</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => setRemoveTarget(member)}
                      aria-label={`Remove ${member.name}`}
                      className="rounded-md px-2 py-1 text-xs font-semibold text-red-300 transition hover:bg-red-950/50"
                    >
                      Remove
                    </button>
                  </>
                ) : (
                  <span className="rounded-full bg-surface-hover px-2 py-1 text-xs capitalize text-secondary">
                    {member.role}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {canManage && (
        <form onSubmit={addMember} className="mt-4 space-y-3 border-t border-line pt-4">
          <h3 className="text-sm font-semibold text-ink">Add a member</h3>
          <div>
            <label
              htmlFor="member-email"
              className="block text-xs font-semibold text-secondary"
            >
              Email address
            </label>
            <input
              id="member-email"
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value)
                setEmailError('')
              }}
              aria-invalid={Boolean(emailError)}
              aria-describedby={emailError ? 'member-email-error' : undefined}
              className="mt-1 block w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink"
            />
            {emailError && (
              <p
                id="member-email-error"
                className="mt-1 text-sm text-red-300"
              >
                {emailError}
              </p>
            )}
          </div>
          <div>
            <label
              htmlFor="member-role"
              className="block text-xs font-semibold text-secondary"
            >
              Role
            </label>
            <select
              id="member-role"
              value={memberRole}
              onChange={(event) =>
                setMemberRole(event.target.value as MemberRole)
              }
              className="mt-1 block w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink"
            >
              <option value="member">Member</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={mutations.addMember.isPending}
            className="w-full rounded-md bg-accent px-3 py-2 text-sm font-semibold text-app transition hover:bg-accent-hover disabled:opacity-60"
          >
            {mutations.addMember.isPending ? 'Adding…' : 'Add member'}
          </button>
        </form>
      )}

      <ConfirmDialog
        open={removeTarget !== null}
        title="Remove member?"
        message={`Remove ${removeTarget?.name ?? 'this member'} from the project? Their story and task assignments will be cleared.`}
        confirmLabel="Remove member"
        pending={removing}
        onClose={() => setRemoveTarget(null)}
        onConfirm={() => void removeMember()}
      />
    </aside>
  )
}
