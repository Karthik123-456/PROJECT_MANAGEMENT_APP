export function getUtcToday(now = new Date()) {
  return now.toISOString().slice(0, 10);
}
