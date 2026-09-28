interface ServerUnavailablePageProps {
  onRetry: () => Promise<void>
}

export function ServerUnavailablePage({
  onRetry,
}: ServerUnavailablePageProps) {
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <section className="max-w-md text-center">
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          Can&apos;t reach the server
        </h1>
        <p className="mt-2 text-sm text-secondary">
          Your session is still saved. Check your connection and try again.
        </p>
        <button
          type="button"
          onClick={() => void onRetry()}
          className="mt-5 rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-app shadow-sm transition hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Retry
        </button>
      </section>
    </main>
  )
}
