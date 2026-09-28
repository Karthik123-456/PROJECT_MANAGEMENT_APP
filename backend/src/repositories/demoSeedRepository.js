const DEMO_PROJECT_NAME = 'Agile Tool Demo Project';

function overdueSeedDate() {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function createDemoSeedRepository(db) {
  const findDemoProjectStatement = db.prepare(`
    SELECT p.id
    FROM projects p
    JOIN users u ON u.id = p.owner_id
    WHERE p.name = ? AND u.email = ?
  `);
  const findSeedUsersStatement = db.prepare(`
    SELECT id, email FROM users
    WHERE email IN (?, ?, ?)
  `);
  const insertProjectStatement = db.prepare(`
    INSERT INTO projects (name, description, owner_id)
    VALUES (?, ?, ?)
  `);
  const insertMemberStatement = db.prepare(`
    INSERT INTO project_members (project_id, user_id, role)
    VALUES (?, ?, ?)
  `);
  const insertStoryStatement = db.prepare(`
    INSERT INTO user_stories (
      project_id, title, description, acceptance_criteria, status,
      priority, story_points, assignee_id, position
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertTaskStatement = db.prepare(`
    INSERT INTO tasks (
      story_id, title, description, status, assignee_id,
      estimate_hours, due_date, position
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  return {
    demoProjectExists(aliceEmail) {
      return Boolean(findDemoProjectStatement.get(DEMO_PROJECT_NAME, aliceEmail));
    },
    findSeedUsers(aliceEmail, bobEmail, charlieEmail) {
      const rows = findSeedUsersStatement.all(aliceEmail, bobEmail, charlieEmail);
      return Object.fromEntries(rows.map(({ id, email }) => [email, id]));
    },
    createDemoProject({ aliceId, bobId, charlieId }) {
      const projectId = Number(insertProjectStatement.run(
        DEMO_PROJECT_NAME,
        'A seeded example project for exploring stories and tasks.',
        aliceId,
      ).lastInsertRowid);
      insertMemberStatement.run(projectId, aliceId, 'owner');
      insertMemberStatement.run(projectId, bobId, 'member');
      insertMemberStatement.run(projectId, charlieId, 'viewer');

      const stories = [
        {
          title: 'Plan project onboarding',
          description: 'Make it easy for a new team to get started.',
          criteria: 'A new team can create a project and invite members.',
          status: 'backlog',
          priority: 'high',
          points: 5,
          assigneeId: bobId,
        },
        {
          title: 'Track work in progress',
          description: 'Show active work and task ownership.',
          criteria: 'Members can identify active work and its assignee.',
          status: 'in_progress',
          priority: 'medium',
          points: 8,
          assigneeId: aliceId,
        },
        {
          title: 'Deliver project summary',
          description: 'Provide a completed summary of project work.',
          criteria: 'The completed summary is available to project members.',
          status: 'done',
          priority: 'low',
          points: 3,
          assigneeId: charlieId,
        },
      ];

      const taskTemplates = [
        [
          ['Draft onboarding checklist', 'todo', bobId, 3, overdueSeedDate()],
          ['Review invitation flow', 'in_progress', aliceId, 2, null],
        ],
        [
          ['Add work status labels', 'done', bobId, 2, null],
          ['Verify assignment display', 'in_progress', aliceId, 1, null],
          ['Update activity timeline', 'todo', charlieId, 4, null],
        ],
        [
          ['Collect completed work', 'done', bobId, 2, null],
          ['Write project summary', 'done', charlieId, 3, null],
        ],
      ];

      stories.forEach((story, storyIndex) => {
        const storyId = Number(insertStoryStatement.run(
          projectId,
          story.title,
          story.description,
          story.criteria,
          story.status,
          story.priority,
          story.points,
          story.assigneeId,
          (storyIndex + 1) * 1000,
        ).lastInsertRowid);
        taskTemplates[storyIndex].forEach(
          ([title, status, assigneeId, estimateHours, dueDate], taskIndex) => {
            insertTaskStatement.run(
              storyId,
              title,
              null,
              status,
              assigneeId,
              estimateHours,
              dueDate,
              (taskIndex + 1) * 1000,
            );
          },
        );
      });
      return projectId;
    },
  };
}
