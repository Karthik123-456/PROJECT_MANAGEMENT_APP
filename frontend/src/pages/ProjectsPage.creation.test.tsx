import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import App from '../App.tsx'
import { AuthProvider } from '../auth/AuthContext.tsx'

describe('project creation', () => {
  it('opens the dialog and creates a project under StrictMode', async () => {
    window.localStorage.setItem('agile.token', 'test-token')
    const project = {
      id: 18,
      name: 'Created project',
      description: 'Created from the projects page',
      owner_id: 3,
      archived_at: null,
      created_at: '2026-09-28T00:00:00.000Z',
      updated_at: '2026-09-28T00:00:00.000Z',
      role: 'owner',
    }
    let created = false
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input)
      let payload: unknown

      if (url.endsWith('/auth/me')) {
        payload = {
          user: {
            id: 3,
            email: 'person@example.com',
            name: 'Person',
            is_admin: false,
            created_at: '2026-09-28T00:00:00.000Z',
          },
        }
      } else if (url.endsWith('/projects') && init?.method === 'POST') {
        created = true
        payload = { project }
      } else {
        payload = {
          data: created ? [project] : [],
          total: created ? 1 : 0,
          limit: 20,
          offset: 0,
        }
      }

      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const showModalDescriptor = Object.getOwnPropertyDescriptor(
      HTMLDialogElement.prototype,
      'showModal',
    )
    const closeDescriptor = Object.getOwnPropertyDescriptor(
      HTMLDialogElement.prototype,
      'close',
    )
    let closeCalls = 0
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.open = true
      },
    })
    Object.defineProperty(HTMLDialogElement.prototype, 'close', {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        closeCalls += 1
        this.open = false
        this.dispatchEvent(new Event('close'))
      },
    })

    try {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      })
      const user = userEvent.setup()
      render(
        <StrictMode>
          <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={['/projects']}>
              <AuthProvider>
                <App />
              </AuthProvider>
            </MemoryRouter>
          </QueryClientProvider>
        </StrictMode>,
      )

      await user.click(await screen.findByRole('button', { name: 'New project' }))
      const dialog = await screen.findByRole('dialog', {
        name: 'Create a project',
      })
      expect(dialog).toHaveProperty('open', true)

      await user.type(
        within(dialog).getByRole('textbox', { name: 'Project name' }),
        project.name,
      )
      await user.type(
        within(dialog).getByRole('textbox', { name: 'Description' }),
        project.description,
      )
      await user.click(
        within(dialog).getByRole('button', { name: 'Create project' }),
      )

      expect(
        await screen.findByRole('heading', { name: project.name }),
      ).toBeInTheDocument()
      await waitFor(() =>
        expect(
          fetchMock.mock.calls.some(
            ([input, init]) =>
              String(input).endsWith('/projects') && init?.method === 'POST',
          ),
        ).toBe(true),
      )
      expect(closeCalls).toBeGreaterThan(0)
    } finally {
      if (showModalDescriptor) {
        Object.defineProperty(
          HTMLDialogElement.prototype,
          'showModal',
          showModalDescriptor,
        )
      } else {
        Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal')
      }
      if (closeDescriptor) {
        Object.defineProperty(
          HTMLDialogElement.prototype,
          'close',
          closeDescriptor,
        )
      } else {
        Reflect.deleteProperty(HTMLDialogElement.prototype, 'close')
      }
    }
  })
})
