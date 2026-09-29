import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import type { Notification, NotificationType } from '../api/types.ts'
import {
  useNotificationList,
  useNotificationMutations,
  useUnreadNotifications,
} from '../projects/useNotifications.ts'

function notificationMessage(notification: Notification): string {
  const { payload } = notification
  if (notification.type === 'task_completed') {
    return `${payload.completedBy.name} completed task '${payload.taskTitle}' in ${payload.projectName}`
  }
  return `${payload.completedBy.name} completed story '${payload.storyTitle}' in ${payload.projectName}`
}

function relativeTime(timestamp: string, now = Date.now()): string {
  const elapsed = Math.max(0, now - new Date(timestamp).getTime())
  const minutes = Math.floor(elapsed / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

function isCompletionType(type: NotificationType): boolean {
  return type === 'task_completed' || type === 'story_completed'
}

export function NotificationBell() {
  const [openedLocation, setOpenedLocation] = useState<string | null>(null)
  const [actionError, setActionError] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const location = useLocation()
  const navigate = useNavigate()
  const locationKey = `${location.pathname}${location.search}${location.hash}`
  const open = openedLocation === locationKey
  const unreadQuery = useUnreadNotifications()
  const listQuery = useNotificationList(open)
  const mutations = useNotificationMutations()
  const unreadCount = unreadQuery.data?.total ?? 0

  useEffect(() => {
    if (!open) return

    function onPointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
        setOpenedLocation(null)
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpenedLocation(null)
      }
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  async function openNotification(notification: Notification) {
    setActionError('')
    try {
      await mutations.markRead.mutateAsync(notification.id)
      setOpenedLocation(null)
      navigate(`/projects/${notification.payload.projectId}`)
    } catch {
      setActionError('Could not mark this notification as read. Please try again.')
    }
  }

  async function markAllRead() {
    setActionError('')
    try {
      await mutations.markAllRead.mutateAsync()
    } catch {
      setActionError('Could not mark notifications as read. Please try again.')
    }
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ', no unread notifications'}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => {
          setActionError('')
          setOpenedLocation(open ? null : locationKey)
        }}
        className="relative rounded-md border border-line p-2 text-secondary transition hover:bg-surface-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <svg
          aria-hidden="true"
          className="h-5 w-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path d="M10 21h4" />
        </svg>
        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-1 -top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-none text-app ring-2 ring-app"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <section
          aria-label="Notifications"
          role="dialog"
          className="absolute right-0 top-full z-50 mt-2 flex max-h-[min(32rem,calc(100vh-5rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-md border border-line bg-surface shadow-xl shadow-black/40"
        >
          <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-ink">Notifications</h2>
              <p className="text-xs text-muted">
                {unreadCount} unread
              </p>
            </div>
            <button
              type="button"
              onClick={() => void markAllRead()}
              disabled={unreadCount === 0 || mutations.markAllRead.isPending}
              className="rounded-md px-2 py-1 text-xs font-semibold text-accent-hover transition hover:bg-accent/10 focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              Mark all as read
            </button>
          </header>

          {actionError && (
            <p role="alert" className="border-b border-line px-4 py-2 text-xs text-red-200">
              {actionError}
            </p>
          )}

          <div className="overflow-y-auto">
            {listQuery.isPending && (
              <p role="status" className="p-6 text-center text-sm text-muted">
                Loading notifications…
              </p>
            )}
            {listQuery.isError && (
              <div className="p-4 text-center">
                <p className="text-sm text-secondary">Could not load notifications.</p>
                <button
                  type="button"
                  onClick={() => void listQuery.refetch()}
                  className="mt-2 rounded-md px-2 py-1 text-xs font-semibold text-accent-hover hover:bg-accent/10"
                >
                  Retry
                </button>
              </div>
            )}
            {!listQuery.isPending && !listQuery.isError && listQuery.data?.data.length === 0 && (
              <p className="p-8 text-center text-sm text-muted">No notifications yet</p>
            )}
            {listQuery.data?.data.map((notification) => {
              const unread = notification.read_at === null
              return (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => void openNotification(notification)}
                  className={`flex w-full items-start gap-3 border-b border-line px-4 py-3 text-left transition last:border-b-0 hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-accent ${
                    unread ? 'bg-accent/5' : ''
                  }`}
                >
                  <span
                    aria-label={unread ? 'Unread' : 'Read'}
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                      unread ? 'bg-accent' : 'border border-muted bg-transparent'
                    }`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm text-ink ${unread ? 'font-semibold' : 'font-normal'}`}>
                      {isCompletionType(notification.type)
                        ? notificationMessage(notification)
                        : 'Project activity notification'}
                    </span>
                    <time
                      className="mt-1 block text-xs text-muted"
                      dateTime={notification.created_at}
                      title={notification.created_at}
                    >
                      {relativeTime(notification.created_at)}
                    </time>
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
