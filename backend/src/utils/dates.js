export function getUtcDateWindow(now = new Date()) {
  const utcToday = now.toISOString().slice(0, 10);
  const dueSoonThroughDate = new Date(
    now.getTime() + 24 * 60 * 60 * 1000,
  ).toISOString().slice(0, 10);

  return { utcToday, dueSoonThroughDate };
}

export function getUtcDate(now = new Date()) {
  return now.toISOString().slice(0, 10);
}
