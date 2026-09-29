import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../auth/AuthContext.tsx'
import { AppLayout } from './AppLayout.tsx'

interface NotificationFixture {
  id: number
  user_id: number
  type: 'task_completed' | 'story_completed'
  payload: {
    kind: 'task_completed' | 'story_completed'
    projectId: number
    projectName: string
    storyId: number
    storyTitle: string
    taskId?: number
    taskTitle?: string
    completedBy: { id: number; name: string }
  }
  idempotency_key: string
  read_at: string | null
  created_at: string
}

const notification: NotificationFixture = {
  id: 71,
  user_id: 3,
  type: 'task_completed',
  payload: {
    kind: 'task_completed',
    projectId: 41,
    projectName: 'Project Alpha',
    storyId: 52,
    storyTitle: 'Planning',
    taskId: 73,
    taskTitle: 'Implement feature',
    completedBy: { id: 4, name: 'Riley' },
  },
  idempotency_key: 'task-73-completed-event',
  read_at: null,
  created_at: new Date().toISOString(),
}

function stubApi(initialNotifications: NotificationFixture[] = [notification]) {
  let notifications = initialNotifications
  const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
    const url = String(input)
    if (url.endsWith('/auth/me')) {
      return new Response(JSON.stringify({
        user: {
          id: 3,
          email: 'person@example.com',
          name: 'Person',
          is_admin: false,
          created_at: '2026-09-28T00:00:00.000Z',
        },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }

    if (url.includes('/notifications/read-all')) {
      notifications = notifications.map((item) => ({
        ...item,
        read_at: item.read_at ?? new Date().toISOString(),
      }))
      return new Response(JSON.stringify({ updated: notifications.length }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (url.includes('/notifications/') && url.endsWith('/read')) {
      const id = Number(url.split('/').at(-2))
      notifications = notifications.map((item) =>
        item.id === id
          ? { ...item, read_at: item.read_at ?? new Date().toISOString() }
          : item,
      )
      const updated = notifications.find((item) => item.id === id)
      return new Response(JSON.stringify({ notification: updated }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (url.includes('/notifications')) {
      const unreadOnly = new URL(url, 'http://localhost').searchParams.get('unread') === 'true'
      const data = unreadOnly
        ? notifications.filter((item) => item.read_at === null)
        : notifications
      return new Response(JSON.stringify({
        data,
        total: data.length,
        limit: 20,
        offset: 0,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }

    throw new Error(`Unexpected fetch: ${init?.method ?? 'GET'} ${url}`)
  })

  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function CurrentPath() {
  const location = useLocation()
  return <output aria-label="Current path">{location.pathname}</output>
}

function renderLayout() {
  window.localStorage.setItem('agile.token', 'saved-token')
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/projects']}>
        <AuthProvider>
          <Routes>
            <Route
              path="*"
              element={
                <AppLayout>
                  <CurrentPath />
                </AppLayout>
              }
            />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('notification bell', () => {
  it('shows the unread count from the unread notifications query', async () => {
    stubApi([notification, { ...notification, id: 72 }])
    renderLayout()

    expect(
      await screen.findByRole('button', { name: 'Notifications, 2 unread' }),
    ).toBeInTheDocument()
  })

  it('marks a notification read and navigates to its project', async () => {
    const fetchMock = stubApi()
    const user = userEvent.setup()
    renderLayout()

    await user.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }))
    await user.click(await screen.findByRole('button', {
      name: /Riley completed task 'Implement feature' in Project Alpha/,
    }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/notifications/71/read',
        expect.objectContaining({ method: 'POST' }),
      )
      expect(screen.getByLabelText('Current path')).toHaveTextContent('/projects/41')
    })
  })

  it('marks all notifications read and clears the unread badge', async () => {
    const fetchMock = stubApi([notification, { ...notification, id: 72 }])
    const user = userEvent.setup()
    renderLayout()

    await user.click(await screen.findByRole('button', { name: 'Notifications, 2 unread' }))
    await user.click(screen.getByRole('button', { name: 'Mark all as read' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/notifications/read-all',
        expect.objectContaining({ method: 'POST' }),
      )
      expect(screen.getByRole('button', {
        name: 'Notifications, no unread notifications',
      })).toBeInTheDocument()
    })
  })

  it('shows the empty state when the notification list is empty', async () => {
    stubApi([])
    const user = userEvent.setup()
    renderLayout()

    await user.click(await screen.findByRole('button', {
      name: 'Notifications, no unread notifications',
    }))
    expect(await screen.findByText('No notifications yet')).toBeInTheDocument()
  })
})
