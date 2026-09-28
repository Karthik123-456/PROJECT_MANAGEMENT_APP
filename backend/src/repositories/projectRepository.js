export function createProjectRepository(db) {
  const findProjectByIdStatement = db.prepare(`
    SELECT id, name, description, owner_id, archived_at, created_at, updated_at
    FROM projects
    WHERE id = ?
  `);
  const insertProjectStatement = db.prepare(`
    INSERT INTO projects (name, description, owner_id)
    VALUES (@name, @description, @ownerId)
  `);
  const updateProjectStatement = db.prepare(`
    UPDATE projects
    SET name = @name, description = @description,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = @id
  `);
  const archiveProjectStatement = db.prepare(`
    UPDATE projects
    SET archived_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = ?
  `);
  const restoreProjectStatement = db.prepare(`
    UPDATE projects
    SET archived_at = NULL, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = ?
  `);
  const listProjectsStatement = db.prepare(`
    SELECT p.id, p.name, p.description, p.owner_id, p.archived_at,
           p.created_at, p.updated_at, pm.role
    FROM projects p
    JOIN project_members pm ON pm.project_id = p.id
    WHERE pm.user_id = @userId
      AND ((@status = 'active' AND p.archived_at IS NULL)
        OR (@status = 'archived' AND p.archived_at IS NOT NULL))
    ORDER BY p.id DESC
    LIMIT @limit OFFSET @offset
  `);
  const countProjectsStatement = db.prepare(`
    SELECT COUNT(*) AS total
    FROM projects p
    JOIN project_members pm ON pm.project_id = p.id
    WHERE pm.user_id = @userId
      AND ((@status = 'active' AND p.archived_at IS NULL)
        OR (@status = 'archived' AND p.archived_at IS NOT NULL))
  `);

  return {
    findById(id) {
      return findProjectByIdStatement.get(id) ?? null;
    },
    create({ name, description = null, ownerId }) {
      const result = insertProjectStatement.run({ name, description, ownerId });
      return this.findById(Number(result.lastInsertRowid));
    },
    update({ id, name, description }) {
      updateProjectStatement.run({ id, name, description });
      return this.findById(id);
    },
    archive(id) {
      archiveProjectStatement.run(id);
      return this.findById(id);
    },
    restore(id) {
      restoreProjectStatement.run(id);
      return this.findById(id);
    },
    listForUser({ userId, status, limit, offset }) {
      const params = { userId, status, limit, offset };
      const rows = listProjectsStatement.all(params);
      const total = countProjectsStatement.get(params).total;
      return { rows, total };
    },
  };
}
