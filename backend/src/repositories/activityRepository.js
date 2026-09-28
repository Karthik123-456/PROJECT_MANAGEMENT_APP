export function createActivityRepository(db) {
  const insertActivityStatement = db.prepare(`
    INSERT INTO activity_log (project_id, actor_id, entity_type, entity_id, action, meta)
    VALUES (@projectId, @actorId, @entityType, @entityId, @action, @meta)
  `);
  const listActivityStatement = db.prepare(`
    SELECT a.id, a.project_id, a.actor_id, u.name AS actor_name,
           a.entity_type, a.entity_id, a.action, a.meta, a.created_at
    FROM activity_log a
    LEFT JOIN users u ON u.id = a.actor_id
    WHERE a.project_id = ?
    ORDER BY a.created_at DESC, a.id DESC
    LIMIT ? OFFSET ?
  `);
  const countActivityStatement = db.prepare(`
    SELECT COUNT(*) AS total FROM activity_log WHERE project_id = ?
  `);

  return {
    insert(event) {
      insertActivityStatement.run({
        ...event,
        meta: JSON.stringify(event.meta ?? {}),
      });
    },
    list(projectId, limit, offset) {
      const rows = listActivityStatement.all(projectId, limit, offset)
        .map(({ meta, ...event }) => ({ ...event, meta: JSON.parse(meta) }));
      const total = countActivityStatement.get(projectId).total;
      return { rows, total };
    },
  };
}
