export function utcToday(now = new Date()): string {
  return now.toISOString().slice(0, 10)
}

export function isOverdue(
  dueDate: string | null,
  status: string,
  today = utcToday(),
): boolean {
  return dueDate !== null && dueDate < today && status !== 'done'
}

export function formatUtcDate(date: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`))
}
