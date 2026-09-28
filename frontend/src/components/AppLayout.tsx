import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth/useAuth.ts'

interface AppLayoutProps {
  children: ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  const { user, logout } = useAuth()

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line bg-app/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link
            className="text-lg font-bold tracking-tight text-ink"
            to="/projects"
          >
            Project Manager
          </Link>
          <div className="flex items-center gap-3">
            <span className="max-w-32 truncate border-r border-line pr-3 text-sm text-secondary sm:max-w-none">
              {user?.name}
            </span>
            <button
              type="button"
              onClick={logout}
              className="rounded-md border border-line px-3 py-1.5 text-xs font-semibold text-secondary transition hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Log out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  )
}
