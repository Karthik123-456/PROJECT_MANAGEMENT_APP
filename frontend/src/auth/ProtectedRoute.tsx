import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { safePostLoginTarget } from './redirect.ts'
import { useAuth } from './useAuth.ts'

interface RouteGuardProps {
  children: ReactNode
}

function SessionLoading() {
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <p role="status" className="rounded-md border border-line bg-surface p-6 text-sm text-muted shadow-sm shadow-black/20">
        Checking your session…
      </p>
    </main>
  )
}

export function ProtectedRoute({ children }: RouteGuardProps) {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') {
    return <SessionLoading />
  }
  if (status !== 'authenticated') {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: location.pathname + location.search + location.hash,
        }}
      />
    )
  }

  return children
}

export function GuestOnlyRoute({ children }: RouteGuardProps) {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') {
    return <SessionLoading />
  }
  if (status === 'authenticated') {
    return (
      <Navigate
        to={safePostLoginTarget(location.state)}
        replace
      />
    )
  }

  return children
}
