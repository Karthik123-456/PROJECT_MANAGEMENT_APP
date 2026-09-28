import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import App from '../App.tsx'
import { AuthProvider } from './AuthContext.tsx'

function renderApp(initialPath = '/projects') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('startup session validation', () => {
  it('clears the token when /auth/me returns 401', async () => {
    window.localStorage.setItem('agile.token', 'expired-token')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: 'UNAUTHENTICATED',
              message: 'Authentication required',
            },
          }),
          { status: 401, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    )

    renderApp()

    expect(
      await screen.findByRole('heading', { name: 'Sign in' }),
    ).toBeInTheDocument()
    expect(window.localStorage.getItem('agile.token')).toBeNull()
  })

  it('keeps the token and offers retry when the network is unavailable', async () => {
    window.localStorage.setItem('agile.token', 'saved-token')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))

    renderApp()

    expect(
      await screen.findByRole('heading', { name: "Can't reach the server" }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
    expect(window.localStorage.getItem('agile.token')).toBe('saved-token')
  })
})
