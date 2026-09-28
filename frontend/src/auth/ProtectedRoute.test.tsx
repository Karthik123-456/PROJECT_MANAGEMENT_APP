import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { ProtectedRoute, GuestOnlyRoute } from './ProtectedRoute.tsx'
import type { AuthContextValue } from './context.ts'
import { useAuth } from './useAuth.ts'
import { safePostLoginTarget } from './redirect.ts'

vi.mock('./useAuth.ts', () => ({
  useAuth: vi.fn(),
}))

function authState(status: AuthContextValue['status']): AuthContextValue {
  return {
    status,
    user: null,
    login: async () => undefined,
    register: async () => undefined,
    logout: () => undefined,
    retryAuthentication: async () => undefined,
  }
}

describe('route guards', () => {
  it('redirects anonymous users to login and preserves their internal path', async () => {
    vi.mocked(useAuth).mockReturnValue(authState('anonymous'))

    render(
      <MemoryRouter initialEntries={['/projects?status=active']}>
        <Routes>
          <Route
            path="/projects"
            element={
              <ProtectedRoute>
                <p>Private projects</p>
              </ProtectedRoute>
            }
          />
          <Route
            path="/login"
            element={<LoginLocation />}
          />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText('Login')).toBeInTheDocument()
    expect(screen.getByText('/projects?status=active')).toBeInTheDocument()
  })

  it('does not follow an external post-login target', async () => {
    vi.mocked(useAuth).mockReturnValue(authState('authenticated'))

    render(
      <MemoryRouter
        initialEntries={[{ pathname: '/login', state: { from: '//evil.example' } }]}
      >
        <Routes>
          <Route
            path="/login"
            element={
              <GuestOnlyRoute>
                <p>Login</p>
              </GuestOnlyRoute>
            }
          />
          <Route path="/projects" element={<p>Projects home</p>} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText('Projects home')).toBeInTheDocument()
  })

  it('rejects scheme and backslash-based post-login targets', () => {
    expect(safePostLoginTarget({ from: 'https://evil.example' })).toBe(
      '/projects',
    )
    expect(safePostLoginTarget({ from: '/\\evil.example' })).toBe('/projects')
  })
})

function LoginLocation() {
  const location = useLocation()
  const state = location.state as { from?: string } | null
  return (
    <p>
      Login <span>{state?.from}</span>
    </p>
  )
}
