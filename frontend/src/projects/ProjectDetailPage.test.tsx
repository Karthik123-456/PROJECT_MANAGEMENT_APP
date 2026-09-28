import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client.ts'
import { AuthProvider } from '../auth/AuthContext.tsx'
import { ProjectDetailPage } from '../pages/ProjectDetailPage.tsx'
import { StoryFormDialog } from './components/FeatureDialogs.tsx'
import type { ProjectRole, ProjectTree } from '../api/types.ts'

const projectTree: ProjectTree = {
  project: {
    id: 41,
    name: 'Project Alpha',
    description: 'A sample project',
    owner_id: 1,
    archived_at: null,
    created_at: '2026-09-28T00:00:00.000Z',
    updated_at: '2026-09-28T00:00:00.000Z',
    role: 'owner',
  },
  stories: [
    {
      id: 71,
      project_id: 41,
      title: 'Planning',
      description: null,
      acceptance_criteria: null,
      status: 'backlog',
      priority: 'high',
      story_points: 3,
      assignee_id: null,
      assignee: null,
      position: 1000,
      created_at: '2026-09-28T00:00:00.000Z',
      updated_at: '2026-09-28T00:00:00.000Z',
      progress: { done_tasks: 0, total_tasks: 1, percent: 0 },
      tasks: [
        {
          id: 91,
          story_id: 71,
          title: 'Implement feature',
          description: null,
          status: 'todo',
          assignee_id: null,
          assignee: null,
          estimate_hours: null,
          due_date: null,
          position: 1000,
          created_at: '2026-09-28T00:00:00.000Z',
          updated_at: '2026-09-28T00:00:00.000Z',
        },
      ],
    },
  ],
}

function makeResponse(payload: unknown, status = 200): Response {
  return new Response(status === 204 ? null : JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function stubProjectApi(
  role: ProjectRole,
  options: { rejectStoryStatus?: boolean } = {},
) {
  window.localStorage.setItem('agile.token', 'test-token')
  const memberList = [
    { id: 1, name: 'Project Owner', email: 'owner@example.com', role: 'owner' },
    {
      id: role === 'viewer' ? 3 : 2,
      name: role === 'viewer' ? 'Project Viewer' : 'Project Member',
      email: role === 'viewer' ? 'viewer@example.com' : 'member@example.com',
      role: role === 'viewer' ? 'viewer' : 'member',
    },
  ]
  const tree = {
    ...projectTree,
    project: { ...projectTree.project, role },
  }
  const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
    const url = String(input)
    if (url.endsWith('/auth/me')) {
      return makeResponse({
        user: {
          id: 1,
          email: 'owner@example.com',
          name: 'Project Owner',
          is_admin: false,
          created_at: '2026-09-28T00:00:00.000Z',
        },
      })
    }
    if (url.endsWith('/projects/41/tree')) {
      return makeResponse(tree)
    }
    if (url.endsWith('/projects/41/members?limit=100&offset=0')) {
      return makeResponse({
        data: memberList,
        total: memberList.length,
        limit: 100,
        offset: 0,
      })
    }
    if (url.endsWith('/projects/41')) {
      return makeResponse({ project: tree.project })
    }
    if (url.endsWith('/stories/71') && init?.method === 'PATCH') {
      if (options.rejectStoryStatus) {
        return makeResponse(
          {
            error: {
              code: 'STORY_HAS_OPEN_TASKS',
              message: 'Story has tasks that are not done',
              details: null,
            },
          },
          409,
        )
      }
      return makeResponse({
        story: { ...tree.stories[0], status: 'done' },
      })
    }
    throw new Error(`Unexpected mocked fetch: ${url}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function renderProjectPage(initialPath = '/projects/41') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialPath]}>
        <AuthProvider>
          <Routes>
            <Route
              path="/projects/:id"
              element={
                <>
                  <ProjectDetailPage />
                  <CurrentSearch />
                </>
              }
            />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function CurrentSearch() {
  const location = useLocation()
  return <output aria-label="Current filters">{location.search}</output>
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('project detail permissions and mutations', () => {
  it('shows owner write controls and management while preserving the owner row', async () => {
    stubProjectApi('owner')
    renderProjectPage()

    expect(
      await screen.findByRole('heading', { name: 'Project Alpha' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'New story' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Delete story Planning' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Delete task Implement feature' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add member' })).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Remove Project Owner' }),
    ).not.toBeInTheDocument()
  })

  it('keeps story creation available to members but hides story deletion and member management', async () => {
    stubProjectApi('member')
    renderProjectPage()

    expect(
      await screen.findByRole('heading', { name: 'Project Alpha' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'New story' })).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Delete story Planning' }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Delete task Implement feature' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add member' })).not.toBeInTheDocument()
  })

  it('renders viewers without story/task mutation controls', async () => {
    stubProjectApi('viewer')
    renderProjectPage()

    expect(
      await screen.findByRole('heading', { name: 'Project Alpha' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'New story' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add task' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit story Planning' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Status for Planning')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Status for Implement feature')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete task Implement feature' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add member' })).not.toBeInTheDocument()
  })

  it('rolls back an optimistic story status change and shows the rule message', async () => {
    const fetchMock = stubProjectApi('owner', { rejectStoryStatus: true })
    const user = userEvent.setup()
    renderProjectPage()

    const status = await screen.findByRole('combobox', {
      name: 'Status for Planning',
    })
    await user.selectOptions(status, 'done')

    expect(
      await screen.findByText('Finish all tasks before completing this story.'),
    ).toBeInTheDocument()
    await waitFor(() => expect(status).toHaveValue('backlog'))
    expect(
      fetchMock.mock.calls.some(
        ([url, init]) =>
          String(url).endsWith('/stories/71') && init?.method === 'PATCH',
      ),
    ).toBe(true)
  })

  it('stores detail filters in shareable URL search params', async () => {
    stubProjectApi('owner')
    const user = userEvent.setup()
    renderProjectPage('/projects/41?priority=high&assignee=unassigned')

    expect(
      await screen.findByRole('heading', { name: 'Project Alpha' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Priority')).toHaveValue('high')
    expect(screen.getByLabelText('Story assignee')).toHaveValue('unassigned')
    await user.selectOptions(screen.getByLabelText('Story status'), 'backlog')
    expect(screen.getByLabelText('Current filters')).toHaveTextContent(
      'priority=high&assignee=unassigned&storyStatus=backlog',
    )
  })
})

describe('story form validation', () => {
  it('places a server validation message beside its field', async () => {
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.setAttribute('open', '')
      },
    })
    Object.defineProperty(HTMLDialogElement.prototype, 'close', {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.removeAttribute('open')
        this.dispatchEvent(new Event('close'))
      },
    })
    const user = userEvent.setup()
    const submit = vi.fn().mockRejectedValue(
      new ApiError(422, 'VALIDATION_ERROR', 'Request validation failed', [
        { path: ['title'], message: 'Title already has an invalid value' },
      ]),
    )

    render(
      <StoryFormDialog
        open
        members={[]}
        saving={false}
        onClose={() => undefined}
        onSubmit={submit}
      />,
    )
    await user.type(await screen.findByLabelText('Title'), 'Draft')
    await user.click(screen.getByRole('button', { name: 'Create story' }))

    const title = screen.getByLabelText('Title')
    expect(await screen.findByText('Title already has an invalid value')).toBeInTheDocument()
    expect(title).toHaveAttribute('aria-invalid', 'true')
    expect(title).toHaveAttribute('aria-describedby', 'title-error')
  })
})
