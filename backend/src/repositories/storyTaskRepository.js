const STORY_SORT_COLUMNS = Object.freeze({
  position: 's.position',
  priority: 'CASE s.priority WHEN \'high\' THEN 0 WHEN \'medium\' THEN 1 ELSE 2 END',
  created_at: 's.created_at',
  story_points: 's.story_points',
});
const STORY_LIST_SQL = `
    SELECT s.id, s.project_id, s.title, s.description, s.acceptance_criteria,
           s.status, s.priority, s.story_points, s.assignee_id, s.position,
           s.created_at, s.updated_at,
           CASE WHEN u.id IS NULL THEN NULL
                ELSE json_object('id', u.id, 'name', u.name, 'email', u.email)
           END AS assignee
    FROM user_stories s
    LEFT JOIN users u ON u.id = s.assignee_id
    WHERE s.project_id = @projectId
      AND (@status IS NULL OR s.status = @status)
      AND (@priority IS NULL OR s.priority = @priority)
      AND (@assigneeId IS NULL OR s.assignee_id = @assigneeId)
    ORDER BY __SORT__ __DIRECTION__, s.id
    LIMIT @limit OFFSET @offset
  `;

function userProjection(prefix) {
  return `json_object('id', ${prefix}.id, 'name', ${prefix}.name, 'email', ${prefix}.email)`;
}

export function createStoryTaskRepository(db) {
  const getStoryStatement = db.prepare(`
    SELECT s.id, s.project_id, s.title, s.description, s.acceptance_criteria,
           s.status, s.priority, s.story_points, s.assignee_id, s.position,
           s.created_at, s.updated_at,
           CASE WHEN u.id IS NULL THEN NULL ELSE ${userProjection('u')} END AS assignee
    FROM user_stories s
    LEFT JOIN users u ON u.id = s.assignee_id
    WHERE s.id = ?
  `);
  const getStorySummaryStatement = db.prepare(`
    SELECT id, project_id, title, status FROM user_stories WHERE id = ?
  `);
  const getStoryCompletionContextStatement = db.prepare(`
    SELECT s.id AS story_id, s.title AS story_title,
           p.id AS project_id, p.name AS project_name,
           owner.user_id AS owner_id,
           actor.id AS completed_by_id, actor.name AS completed_by_name
    FROM user_stories s
    JOIN projects p ON p.id = s.project_id
    JOIN project_members owner
      ON owner.project_id = p.id AND owner.role = 'owner'
    JOIN users actor ON actor.id = ?
    WHERE s.id = ?
  `);
  const getTaskCompletionContextStatement = db.prepare(`
    SELECT t.id AS task_id, t.title AS task_title,
           s.id AS story_id, s.title AS story_title,
           p.id AS project_id, p.name AS project_name,
           owner.user_id AS owner_id,
           actor.id AS completed_by_id, actor.name AS completed_by_name
    FROM tasks t
    JOIN user_stories s ON s.id = t.story_id
    JOIN projects p ON p.id = s.project_id
    JOIN project_members owner
      ON owner.project_id = p.id AND owner.role = 'owner'
    JOIN users actor ON actor.id = ?
    WHERE t.id = ?
  `);
  const countStoriesStatement = db.prepare(`
    SELECT COUNT(*) AS total FROM user_stories s
    WHERE s.project_id = @projectId
      AND (@status IS NULL OR s.status = @status)
      AND (@priority IS NULL OR s.priority = @priority)
      AND (@assigneeId IS NULL OR s.assignee_id = @assigneeId)
  `);
  const maxStoryPositionStatement = db.prepare(`
    SELECT COALESCE(MAX(position), 0) AS position FROM user_stories WHERE project_id = ?
  `);
  const insertStoryStatement = db.prepare(`
    INSERT INTO user_stories (
      project_id, title, description, acceptance_criteria, status,
      priority, story_points, assignee_id, position
    ) VALUES (
      @projectId, @title, @description, @acceptanceCriteria, @status,
      @priority, @storyPoints, @assigneeId, @position
    )
  `);
  const updateStoryStatement = db.prepare(`
    UPDATE user_stories
    SET title = @title, description = @description,
        acceptance_criteria = @acceptanceCriteria, status = @status,
        priority = @priority, story_points = @storyPoints,
        assignee_id = @assigneeId, position = @position,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = @id
  `);
  const deleteStoryStatement = db.prepare('DELETE FROM user_stories WHERE id = ?');
  const hasOpenTasksStatement = db.prepare(`
    SELECT EXISTS(
      SELECT 1 FROM tasks WHERE story_id = ? AND status != 'done'
    ) AS has_open
  `);
  const isProjectMemberStatement = db.prepare(`
    SELECT EXISTS(
      SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?
    ) AS is_member
  `);
  const getTaskStatement = db.prepare(`
    SELECT t.id, t.story_id, t.title, t.description, t.status, t.assignee_id,
           t.estimate_hours, t.due_date, t.position, t.created_at, t.updated_at,
           s.project_id,
           CASE WHEN u.id IS NULL THEN NULL ELSE ${userProjection('u')} END AS assignee
    FROM tasks t
    JOIN user_stories s ON s.id = t.story_id
    LEFT JOIN users u ON u.id = t.assignee_id
    WHERE t.id = ?
  `);
  const listTasksStatement = db.prepare(`
    SELECT t.id, t.story_id, t.title, t.description, t.status, t.assignee_id,
           t.estimate_hours, t.due_date, t.position, t.created_at, t.updated_at,
           CASE WHEN u.id IS NULL THEN NULL ELSE ${userProjection('u')} END AS assignee
    FROM tasks t
    LEFT JOIN users u ON u.id = t.assignee_id
    WHERE t.story_id = @storyId
      AND (@status IS NULL OR t.status = @status)
      AND (@assigneeId IS NULL OR t.assignee_id = @assigneeId)
    ORDER BY t.position, t.id
    LIMIT @limit OFFSET @offset
  `);
  const countTasksStatement = db.prepare(`
    SELECT COUNT(*) AS total FROM tasks t
    WHERE t.story_id = @storyId
      AND (@status IS NULL OR t.status = @status)
      AND (@assigneeId IS NULL OR t.assignee_id = @assigneeId)
  `);
  const maxTaskPositionStatement = db.prepare(`
    SELECT COALESCE(MAX(position), 0) AS position FROM tasks WHERE story_id = ?
  `);
  const insertTaskStatement = db.prepare(`
    INSERT INTO tasks (
      story_id, title, description, status, assignee_id, estimate_hours, due_date, position
    ) VALUES (
      @storyId, @title, @description, @status, @assigneeId, @estimateHours, @dueDate, @position
    )
  `);
  const updateTaskStatement = db.prepare(`
    UPDATE tasks
    SET title = @title, description = @description, status = @status,
        assignee_id = @assigneeId, estimate_hours = @estimateHours,
        due_date = @dueDate, position = @position,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = @id
  `);
  const deleteTaskStatement = db.prepare('DELETE FROM tasks WHERE id = ?');
  const listMyTasksStatement = db.prepare(`
    SELECT t.id, t.story_id, t.title, t.description, t.status, t.assignee_id,
           t.estimate_hours, t.due_date, t.position, t.created_at, t.updated_at,
           s.title AS story_title, p.id AS project_id, p.name AS project_name,
           CASE WHEN u.id IS NULL THEN NULL ELSE ${userProjection('u')} END AS assignee
    FROM tasks t
    JOIN user_stories s ON s.id = t.story_id
    JOIN projects p ON p.id = s.project_id
    JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = @userId
    LEFT JOIN users u ON u.id = t.assignee_id
    WHERE t.assignee_id = @userId
      AND p.archived_at IS NULL
      AND (@status IS NULL OR t.status = @status)
      AND (@overdue = 0 OR (t.due_date < @today AND t.status != 'done'))
    ORDER BY (t.due_date IS NULL), t.due_date, t.id
    LIMIT @limit OFFSET @offset
  `);
  const countMyTasksStatement = db.prepare(`
    SELECT COUNT(*) AS total
    FROM tasks t
    JOIN user_stories s ON s.id = t.story_id
    JOIN projects p ON p.id = s.project_id
    JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = @userId
    WHERE t.assignee_id = @userId
      AND p.archived_at IS NULL
      AND (@status IS NULL OR t.status = @status)
      AND (@overdue = 0 OR (t.due_date < @today AND t.status != 'done'))
  `);
  const treeStoriesStatement = db.prepare(`
    SELECT s.id, s.project_id, s.title, s.description, s.acceptance_criteria,
           s.status, s.priority, s.story_points, s.assignee_id, s.position,
           s.created_at, s.updated_at,
           CASE WHEN u.id IS NULL THEN NULL ELSE ${userProjection('u')} END AS assignee,
           SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) AS done_tasks,
           COUNT(t.id) AS total_tasks,
           CASE WHEN COUNT(t.id) = 0 THEN 0
                ELSE CAST(
                  100.0 * SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) / COUNT(t.id)
                  AS INTEGER
                )
           END AS percent
    FROM user_stories s
    LEFT JOIN users u ON u.id = s.assignee_id
    LEFT JOIN tasks t ON t.story_id = s.id
    WHERE s.project_id = ?
    GROUP BY s.id
    ORDER BY s.position, s.id
  `);
  const treeTasksStatement = db.prepare(`
    SELECT t.id, t.story_id, t.title, t.description, t.status, t.assignee_id,
           t.estimate_hours, t.due_date, t.position, t.created_at, t.updated_at,
           CASE WHEN u.id IS NULL THEN NULL ELSE ${userProjection('u')} END AS assignee
    FROM tasks t
    JOIN user_stories s ON s.id = t.story_id
    LEFT JOIN users u ON u.id = t.assignee_id
    WHERE s.project_id = ?
    ORDER BY t.story_id, t.position, t.id
  `);

  return {
    getStory: (id) => decodeAssignee(getStoryStatement.get(id)),
    getStorySummary: (id) => getStorySummaryStatement.get(id) ?? null,
    getStoryCompletionContext: (storyId, actorId) =>
      getStoryCompletionContextStatement.get(actorId, storyId) ?? null,
    listStories({ projectId, status = null, priority = null, assigneeId = null, sort, limit, offset }) {
      const [sortField, direction = 'asc'] = sort.startsWith('-')
        ? [sort.slice(1), 'desc']
        : [sort, 'asc'];
      const sql = STORY_LIST_SQL
        .replace('__SORT__', STORY_SORT_COLUMNS[sortField])
        .replace('__DIRECTION__', direction);
      const statement = db.prepare(sql);
      const params = { projectId, status, priority, assigneeId, limit, offset };
      const rows = statement.all(params).map(decodeAssignee);
      const total = countStoriesStatement.get(params).total;
      return { rows, total };
    },
    nextStoryPosition(projectId) {
      return maxStoryPositionStatement.get(projectId).position + 1000;
    },
    createStory(data) {
      const result = insertStoryStatement.run(data);
      return this.getStory(Number(result.lastInsertRowid));
    },
    updateStory(data) {
      updateStoryStatement.run(data);
      return this.getStory(data.id);
    },
    deleteStory(id) {
      return deleteStoryStatement.run(id).changes === 1;
    },
    hasOpenTasks(storyId) {
      return Boolean(hasOpenTasksStatement.get(storyId).has_open);
    },
    isProjectMember(projectId, userId) {
      return Boolean(isProjectMemberStatement.get(projectId, userId).is_member);
    },
    getTask: (id) => decodeAssignee(getTaskStatement.get(id)),
    getTaskCompletionContext: (taskId, actorId) =>
      getTaskCompletionContextStatement.get(actorId, taskId) ?? null,
    listTasks({ storyId, status = null, assigneeId = null, limit, offset }) {
      const params = { storyId, status, assigneeId, limit, offset };
      return {
        rows: listTasksStatement.all(params).map(decodeAssignee),
        total: countTasksStatement.get(params).total,
      };
    },
    nextTaskPosition(storyId) {
      return maxTaskPositionStatement.get(storyId).position + 1000;
    },
    createTask(data) {
      const result = insertTaskStatement.run(data);
      return this.getTask(Number(result.lastInsertRowid));
    },
    updateTask(data) {
      updateTaskStatement.run(data);
      return this.getTask(data.id);
    },
    deleteTask(id) {
      return deleteTaskStatement.run(id).changes === 1;
    },
    listMyTasks({ userId, status = null, overdue, today, limit, offset }) {
      const params = { userId, status, overdue: Number(overdue), today, limit, offset };
      return {
        rows: listMyTasksStatement.all(params).map(decodeAssignee),
        total: countMyTasksStatement.get(params).total,
      };
    },
    getTree(projectId) {
      return {
        stories: treeStoriesStatement.all(projectId).map((row) => {
          const {
            done_tasks: doneTasks,
            total_tasks: totalTasks,
            percent,
            ...story
          } = row;
          return {
            ...decodeAssignee(story),
            progress: {
              done_tasks: doneTasks,
              total_tasks: totalTasks,
              percent,
            },
            tasks: [],
          };
        }),
        tasks: treeTasksStatement.all(projectId).map(decodeAssignee),
      };
    },
  };
}

function decodeAssignee(row) {
  if (!row) return null;
  return { ...row, assignee: row.assignee ? JSON.parse(row.assignee) : null };
}
