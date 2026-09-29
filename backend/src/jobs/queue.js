import { env } from '../config/env.js';

const DEFAULT_MAX_ATTEMPTS = () => env.JOB_MAX_ATTEMPTS;
const BASE_BACKOFF_MS = 5000;
const MAX_BACKOFF_MS = 15 * 60 * 1000;
const MAX_JITTER_MS = 1000;

function isoNow(now) {
  return (typeof now === 'function' ? now() : now).toISOString();
}

function serializeJob(row) {
  if (!row) return null;
  return {
    ...row,
    payload: JSON.parse(row.payload),
    result: row.result === null ? null : JSON.parse(row.result),
  };
}

export function enqueue(db, { type, payload, idempotencyKey, runAt }) {
  if (typeof idempotencyKey !== 'string' || idempotencyKey.length === 0) {
    throw new TypeError('A non-empty idempotencyKey is required');
  }

  const result = db.prepare(`
    INSERT INTO jobs (type, payload, max_attempts, run_at, idempotency_key)
    VALUES (?, ?, ?, COALESCE(?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')), ?)
    ON CONFLICT(idempotency_key) DO NOTHING
  `).run(
    type,
    JSON.stringify(payload),
    env.JOB_MAX_ATTEMPTS,
    runAt ?? null,
    idempotencyKey,
  );

  return result.changes === 1 ? Number(result.lastInsertRowid) : null;
}

export function claim(db, workerId, { now = () => new Date() } = {}) {
  const claimedAt = isoNow(now);
  const claimed = db.prepare(`
    UPDATE jobs
    SET status = 'running',
        locked_by = ?,
        locked_at = ?,
        finished_at = NULL
    WHERE id = (
      SELECT id FROM jobs
      WHERE status = 'pending'
        AND run_at <= ?
        AND attempts < max_attempts
      ORDER BY run_at, id
      LIMIT 1
    )
    RETURNING *
  `).get(workerId, claimedAt, claimedAt);

  return serializeJob(claimed);
}

export function complete(db, jobId, workerId, result = null, { now = () => new Date() } = {}) {
  const update = db.prepare(`
    UPDATE jobs
    SET status = 'succeeded',
        result = ?,
        last_error = NULL,
        locked_by = NULL,
        locked_at = NULL,
        finished_at = ?
    WHERE id = ? AND status = 'running' AND locked_by = ?
  `).run(
    result === null ? null : JSON.stringify(result),
    isoNow(now),
    jobId,
    workerId,
  );

  return update.changes === 1;
}

export function fail(
  db,
  jobId,
  workerId,
  error,
  maxAttemptsFn = DEFAULT_MAX_ATTEMPTS,
  { now = () => new Date(), random = Math.random } = {},
) {
  return db.transaction(() => {
    const job = db.prepare(`
      SELECT attempts, max_attempts FROM jobs
      WHERE id = ? AND status = 'running' AND locked_by = ?
    `).get(jobId, workerId);
    if (!job) return false;

    const maxAttempts = maxAttemptsFn(job);
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
      throw new TypeError('maxAttemptsFn must return a positive integer');
    }

    const attempts = job.attempts + 1;
    const dead = attempts >= maxAttempts;
    const timestamp = now();
    const baseBackoff = Math.min(
      BASE_BACKOFF_MS * (2 ** job.attempts),
      MAX_BACKOFF_MS,
    );
    const jitter = Math.floor(random() * (Math.min(MAX_JITTER_MS, baseBackoff) + 1));
    const runAt = new Date(timestamp.getTime() + baseBackoff + jitter).toISOString();
    const message = error instanceof Error ? error.message : String(error);

    const update = db.prepare(`
      UPDATE jobs
      SET status = ?,
          attempts = ?,
          run_at = ?,
          last_error = ?,
          locked_by = NULL,
          locked_at = NULL,
          finished_at = ?
      WHERE id = ? AND status = 'running' AND locked_by = ?
    `).run(
      dead ? 'dead' : 'pending',
      attempts,
      runAt,
      message.slice(0, 2000),
      dead ? timestamp.toISOString() : null,
      jobId,
      workerId,
    );

    return update.changes === 1;
  }).immediate();
}

export function recoverStuck(
  db,
  lockTimeoutMs,
  { now = () => new Date() } = {},
) {
  if (!Number.isFinite(lockTimeoutMs) || lockTimeoutMs < 1) {
    throw new TypeError('lockTimeoutMs must be a positive number');
  }

  const currentTime = now();
  const lockCutoff = new Date(currentTime.getTime() - lockTimeoutMs).toISOString();
  const update = db.prepare(`
    UPDATE jobs
    SET status = 'pending',
        locked_by = NULL,
        locked_at = NULL,
        run_at = ?,
        last_error = COALESCE(last_error, 'Recovered after worker lock timeout')
    WHERE status = 'running' AND locked_at <= ?
  `).run(currentTime.toISOString(), lockCutoff);

  return update.changes;
}
