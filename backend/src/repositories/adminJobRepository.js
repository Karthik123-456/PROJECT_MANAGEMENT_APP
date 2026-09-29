export function createAdminJobRepository(db) {
  const listStatement = db.prepare(`
    SELECT id, type, payload, status, attempts, max_attempts, run_at,
           locked_at, locked_by, last_error, result, idempotency_key,
           created_at, finished_at
    FROM jobs
    WHERE (@status IS NULL OR status = @status)
    ORDER BY created_at DESC, id DESC
    LIMIT @limit OFFSET @offset
  `);
  const countStatement = db.prepare(`
    SELECT COUNT(*) AS total FROM jobs
    WHERE (@status IS NULL OR status = @status)
  `);
  const findStatement = db.prepare(`
    SELECT id, type, payload, status, attempts, max_attempts, run_at,
           locked_at, locked_by, last_error, result, idempotency_key,
           created_at, finished_at
    FROM jobs WHERE id = ?
  `);
  const retryStatement = db.prepare(`
    UPDATE jobs
    SET status = 'pending',
        attempts = 0,
        run_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
        locked_at = NULL,
        locked_by = NULL,
        last_error = NULL,
        result = NULL,
        finished_at = NULL
    WHERE id = ? AND status = 'dead'
  `);

  function decode(row) {
    if (!row) return null;
    return {
      ...row,
      payload: JSON.parse(row.payload),
      result: row.result === null ? null : JSON.parse(row.result),
    };
  }

  return {
    list({ status, limit, offset }) {
      const params = { status: status ?? null, limit, offset };
      return {
        rows: listStatement.all(params).map(decode),
        total: countStatement.get(params).total,
      };
    },
    find(id) {
      return decode(findStatement.get(id));
    },
    retry(id) {
      return retryStatement.run(id).changes === 1;
    },
  };
}
