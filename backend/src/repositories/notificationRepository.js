export function createNotificationRepository(db) {
  const findProjectOwnerStatement = db.prepare(`
    SELECT user_id FROM project_members
    WHERE project_id = ? AND role = 'owner'
  `);
  const insertStatement = db.prepare(`
    INSERT INTO notifications (user_id, type, payload, idempotency_key)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(idempotency_key) DO NOTHING
  `);
  const listStatement = db.prepare(`
    SELECT id, user_id, type, payload, idempotency_key, read_at, created_at
    FROM notifications
    WHERE user_id = @userId AND (@unread = 0 OR read_at IS NULL)
    ORDER BY created_at DESC, id DESC
    LIMIT @limit OFFSET @offset
  `);
  const countStatement = db.prepare(`
    SELECT COUNT(*) AS total FROM notifications
    WHERE user_id = @userId AND (@unread = 0 OR read_at IS NULL)
  `);
  const findOwnedStatement = db.prepare(`
    SELECT id, user_id, type, payload, idempotency_key, read_at, created_at
    FROM notifications
    WHERE id = ? AND user_id = ?
  `);
  const markReadStatement = db.prepare(`
    UPDATE notifications
    SET read_at = COALESCE(read_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    WHERE id = ? AND user_id = ?
  `);
  const markAllReadStatement = db.prepare(`
    UPDATE notifications
    SET read_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE user_id = ? AND read_at IS NULL
  `);

  function decode(row) {
    return row ? { ...row, payload: JSON.parse(row.payload) } : null;
  }

  return {
    findProjectOwner(projectId) {
      return findProjectOwnerStatement.get(projectId) ?? null;
    },
    create({ userId, type, payload, idempotencyKey }) {
      return insertStatement.run(
        userId,
        type,
        JSON.stringify(payload),
        idempotencyKey,
      ).changes === 1;
    },
    listForUser({ userId, unread, limit, offset }) {
      const params = { userId, unread: Number(unread), limit, offset };
      return {
        rows: listStatement.all(params).map(decode),
        total: countStatement.get(params).total,
      };
    },
    findOwned(id, userId) {
      return decode(findOwnedStatement.get(id, userId));
    },
    markRead(id, userId) {
      return markReadStatement.run(id, userId).changes === 1;
    },
    markAllRead(userId) {
      return markAllReadStatement.run(userId).changes;
    },
  };
}
