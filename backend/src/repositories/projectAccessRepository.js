const PROJECT_SQL = `
  SELECT p.id, p.name, p.description, p.owner_id, p.archived_at,
         p.created_at, p.updated_at, pm.role
  FROM projects p
  JOIN project_members pm ON pm.project_id = p.id
  WHERE p.id = ? AND pm.user_id = ?
`;

export function createProjectAccessRepository(db) {
  const findProjectAccessStatement = db.prepare(PROJECT_SQL);
  const findStoryAccessStatement = db.prepare(`
    SELECT p.id, p.name, p.description, p.owner_id, p.archived_at,
           p.created_at, p.updated_at, pm.role
    FROM user_stories s
    JOIN projects p ON p.id = s.project_id
    JOIN project_members pm ON pm.project_id = p.id
    WHERE s.id = ? AND pm.user_id = ?
  `);
  const findTaskAccessStatement = db.prepare(`
    SELECT p.id, p.name, p.description, p.owner_id, p.archived_at,
           p.created_at, p.updated_at, pm.role
    FROM tasks t
    JOIN user_stories s ON s.id = t.story_id
    JOIN projects p ON p.id = s.project_id
    JOIN project_members pm ON pm.project_id = p.id
    WHERE t.id = ? AND pm.user_id = ?
  `);

  return {
    findProjectAccess({ from, id, userId }) {
      const statements = {
        project: findProjectAccessStatement,
        story: findStoryAccessStatement,
        task: findTaskAccessStatement,
      };
      const row = statements[from].get(id, userId);
      if (!row) return null;
      const { role, ...project } = row;
      return { project, role };
    },
  };
}
