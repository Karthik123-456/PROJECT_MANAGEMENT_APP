import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import App from '../App.tsx'
import { AuthProvider } from '../auth/AuthContext.tsx'

describe('projects data pipeline', () => {
  it('loads and displays projects through TanStack Query', async () => {
    window.localStorage.setItem('agile.token', 'saved-token')
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = new URL(String(input), 'http://localhost')
      let payload: unknown

      if (url.pathname.endsWith('/auth/me')) {
        payload = {
          user: {
            id: 3,
            email: 'person@example.com',
            name: 'Person',
            is_admin: false,
            created_at: '2026-09-28T00:00:00.000Z',
          },
        }
      } else if (url.pathname.endsWith('/notifications')) {
        payload = { data: [], total: 0, limit: 20, offset: 0 }
      } else if (
        url.pathname.endsWith('/projects') &&
        url.searchParams.get('status') === 'active'
      ) {
        payload = {
          data: [
            {
              id: 17,
              name: 'Launch planning',
              description: 'Plan the first release',
              owner_id: 3,
              archived_at: null,
              created_at: '2026-09-28T00:00:00.000Z',
              updated_at: '2026-09-28T00:00:00.000Z',
              role: 'owner',
            },
          ],
          total: 1,
          limit: 20,
          offset: 0,
        }
      } else {
        throw new Error(`Unexpected mocked fetch: ${url.pathname}${url.search}`)
      }

      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/projects']}>
          <AuthProvider>
            <App />
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    )

    expect(
      await screen.findByRole('heading', { name: 'Launch planning' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Plan the first release')).toBeInTheDocument()
    expect(screen.getByText('Your role: owner')).toBeInTheDocument()

    const projectsCall = fetchMock.mock.calls.find(([input]) =>
      String(input).includes('/projects?'),
    )
    expect(projectsCall).toBeDefined()
    expect(
      new Headers(projectsCall?.[1]?.headers).get('Authorization'),
    ).toBe('Bearer saved-token')
  })
})
