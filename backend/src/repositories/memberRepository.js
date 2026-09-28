export function createMemberRepository(db) {
  const findUserByEmailStatement = db.prepare(`
    SELECT id, name, email FROM users WHERE email = ?
  `);
  const findMemberStatement = db.prepare(`
    SELECT pm.project_id, pm.user_id AS id, pm.role, u.name, u.email
    FROM project_members pm
    JOIN users u ON u.id = pm.user_id
    WHERE pm.project_id = ? AND pm.user_id = ?
  `);
  const insertMemberStatement = db.prepare(`
    INSERT INTO project_members (project_id, user_id, role)
    VALUES (@projectId, @userId, @role)
  `);
  const updateMemberRoleStatement = db.prepare(`
    UPDATE project_members SET role = @role
    WHERE project_id = @projectId AND user_id = @userId
  `);
  const deleteMemberStatement = db.prepare(`
    DELETE FROM project_members WHERE project_id = ? AND user_id = ?
  `);
  const listMembersStatement = db.prepare(`
    SELECT pm.user_id AS id, u.name, u.email, pm.role
    FROM project_members pm
    JOIN users u ON u.id = pm.user_id
    WHERE pm.project_id = ?
    ORDER BY CASE pm.role WHEN 'owner' THEN 0 WHEN 'member' THEN 1 ELSE 2 END, u.name, u.id
    LIMIT ? OFFSET ?
  `);
  const countMembersStatement = db.prepare(`
    SELECT COUNT(*) AS total FROM project_members WHERE project_id = ?
  `);
  const clearStoryAssigneesStatement = db.prepare(`
    UPDATE user_stories SET assignee_id = NULL
    WHERE project_id = ? AND assignee_id = ?
  `);
  const clearTaskAssigneesStatement = db.prepare(`
    UPDATE tasks SET assignee_id = NULL
    WHERE assignee_id = ?
      AND story_id IN (SELECT id FROM user_stories WHERE project_id = ?)
  `);

  return {
    findUserByEmail(email) {
      return findUserByEmailStatement.get(email) ?? null;
    },
    findById(projectId, userId) {
      return findMemberStatement.get(projectId, userId) ?? null;
    },
    add({ projectId, userId, role }) {
      insertMemberStatement.run({ projectId, userId, role });
      return this.findById(projectId, userId);
    },
    setRole({ projectId, userId, role }) {
      updateMemberRoleStatement.run({ projectId, userId, role });
      return this.findById(projectId, userId);
    },
    remove(projectId, userId) {
      clearStoryAssigneesStatement.run(projectId, userId);
      clearTaskAssigneesStatement.run(userId, projectId);
      return deleteMemberStatement.run(projectId, userId).changes === 1;
    },
    list(projectId, limit, offset) {
      const rows = listMembersStatement.all(projectId, limit, offset);
      const total = countMembersStatement.get(projectId).total;
      return { rows, total };
    },
  };
}
