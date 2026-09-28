function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isInternalPath(path: string): boolean {
  const hasSingleLeadingSlash =
    path.startsWith('/') &&
    !path.startsWith('//') &&
    !/^[a-z][a-z\d+.-]*:/i.test(path)
  if (!hasSingleLeadingSlash) {
    return false
  }

  try {
    return new URL(path, window.location.origin).origin === window.location.origin
  } catch {
    return false
  }
}

export function safePostLoginTarget(state: unknown): string {
  if (!isRecord(state)) {
    return '/projects'
  }

  const from = state.from
  if (typeof from === 'string') {
    return isInternalPath(from) ? from : '/projects'
  }

  if (isRecord(from) && typeof from.pathname === 'string') {
    const search = typeof from.search === 'string' ? from.search : ''
    const hash = typeof from.hash === 'string' ? from.hash : ''
    const target = from.pathname + search + hash
    return isInternalPath(target) ? target : '/projects'
  }

  return '/projects'
}
