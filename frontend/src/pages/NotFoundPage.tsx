import { Link } from 'react-router'

export function NotFoundPage() {
  return (
    <section className="rounded-md border border-line bg-surface p-8 shadow-sm shadow-black/20">
      <h1 className="text-2xl font-bold text-ink">Page not found</h1>
      <p className="mt-2 text-secondary">
        The page you requested does not exist.
      </p>
      <Link
        to="/projects"
        className="mt-5 inline-flex font-semibold text-accent-hover hover:text-accent"
      >
        Back to projects
      </Link>
    </section>
  )
}
