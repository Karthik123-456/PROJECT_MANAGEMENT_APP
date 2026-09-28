# PROJECT_SPEC: Agile Project Management Tool
Authoritative build spec. Read before generating code. If code and spec disagree, ask first.

## Summary
Full-stack tool for teams of 3-10 to manage Project → User Story → Task.
Users create, assign, update status, and view progress across the hierarchy.
A background worker handles notifications, due-date reminders, and reports.

## Non-goals
No sprints, websockets/SSE, microservices, GraphQL, file uploads, email verification,
password reset, OAuth, real SMTP, ownership transfer.

## Stack
- Backend: Node 20+ LTS, Express, ES modules only (never require)
- DB: SQLite via better-sqlite3 (sync), numbered .sql migrations + small runner
- Validation: Zod. Auth: JWT (HS256, access token) + bcrypt cost 12 (bcryptjs if install fails)
- Security: helmet, cors (single origin), express-rate-limit. Logging: pino
- Docs: backend/openapi.yaml served at /docs (swagger-ui-express)
- Tests: Vitest + Supertest (backend), Vitest + Testing Library (frontend)
- Frontend: React + Vite + TypeScript, Tailwind, TanStack Query, React Router, optional @dnd-kit
- Jobs: DB-backed queue + separate worker process, no Redis
- Packaging: Docker Compose (api, worker, web)

## Layering
route → middleware (auth, validate, role) → controller → service → repository → SQLite
- Controllers: HTTP in/out only. Services: business rules, transactions, enqueue jobs, activity log.
- Repositories: ALL SQL, prepared statements only, allowlist for ORDER BY columns.
- Errors: throw AppError(status, code, message, details); central errorHandler formats them.

## Structure
backend/src/{config,db/migrations,middleware,routes,controllers,services,repositories,
schemas,jobs/handlers,utils}, backend/{tests,scripts}, frontend/ (Vite, later),
docs/{architecture,schema,decisions,security}.md, docker-compose.yml, README.md

## Data model
IDs INTEGER PK AUTOINCREMENT. Timestamps ISO-8601 UTC text. Enums TEXT + CHECK.
- users: email UNIQUE NOCASE, name, password_hash, is_admin
- projects: name, description, owner_id, archived_at, created_at, updated_at
- project_members: PK(project_id, user_id), role owner|member|viewer, cascade
- user_stories: project_id (cascade), title, description, acceptance_criteria,
  status backlog|in_progress|in_review|done, priority low|medium|high,
  story_points, assignee_id (SET NULL), position REAL
- tasks: story_id (cascade), title, description, status todo|in_progress|done,
  assignee_id (SET NULL), estimate_hours, due_date, position REAL
- activity_log: project_id (cascade), actor_id, entity_type, entity_id, action, meta JSON
- notifications: user_id (cascade), type, payload, idempotency_key UNIQUE, read_at
- jobs: type, payload, status pending|running|succeeded|dead, attempts, max_attempts,
  run_at, locked_at, locked_by, last_error, result, idempotency_key UNIQUE, finished_at
Indexes: every FK, stories(project_id,status), tasks(story_id,status), tasks(assignee_id),
tasks(due_date), notifications(user_id,read_at), jobs(status,run_at).
Progress (done_tasks / total_tasks) is computed on read, never stored.

## Decisions (authoritative)

### Roles
- viewer: read only. member: create/edit stories and tasks, change status, request reports.
- owner: everything, including editing/archiving project, managing members, deleting stories.
- Admin endpoints (jobs) require users.is_admin = 1, separate from project roles.

### Access policy
- Nested resources resolve up to the project (task → story → project), then check membership.
  One shared helper. Never trust a client-supplied project id.
- Non-member requesting a project resource: 404 (don't leak existence).
- Member with insufficient role: 403.
- Archived projects: readable by members, all writes return 409 PROJECT_ARCHIVED. Owner can restore.
- Projects are soft-archived (archived_at). Stories and tasks are hard-deleted with cascade.

### Business rules
- Creating a project inserts the creator as owner in the same transaction. One owner only,
  cannot be removed or demoted.
- Assignee must be a project member, else 422.
- Story cannot be done while tasks are not done: 409 STORY_HAS_OPEN_TASKS.
- Creating a task in a done story: 409 STORY_DONE.
- Reorder: position = midpoint of neighbours.
- Optional: first task moving to in_progress moves a backlog story to in_progress (same transaction).

### SQLite
- PRAGMAs on every connection: journal_mode=WAL, foreign_keys=ON,
  busy_timeout=5000, synchronous=NORMAL.
- Writes use db.transaction(fn).immediate() and stay short (API and worker share the file).

### Jobs
- Business change and job row are written in the same transaction (transactional outbox).
- Claim is one atomic UPDATE ... WHERE id = (SELECT ...) RETURNING *.
- jobs has locked_by. Complete/fail only succeed WHERE status='running' AND locked_by=?.
- idempotency_key is UNIQUE (insert ON CONFLICT DO NOTHING).
- Failure: store last_error. attempts < max (5): back to pending with
  run_at = now + min(5s * 2^attempts, 15min) + jitter. Else dead.
- Crash recovery: running longer than JOB_LOCK_TIMEOUT_MS resets to pending.
- Handlers are idempotent, one transaction each. SIGTERM: finish current job, then exit.
- Types: send_notification (assign, status change, story done), due_reminder_scan
  (scheduler, key reminder-task-<id>-<date>), generate_project_report (202 + poll).
- SIMULATE_EMAIL_FAILURE_RATE makes the fake email fail to demo retries and dead-lettering.

## API conventions
- Base /api/v1, JSON only. GET /health outside the versioned path. Bearer JWT except
  register, login, health.
- Codes: 200, 201, 202, 204, 400 bad JSON, 401, 403 role, 404 missing/non-member,
  409 rule conflict, 422 validation, 429, 500.
- Error envelope always: { "error": { "code", "message", "details" } }
- Lists: ?limit= (default 20, max 100) &offset=, response { data, total, limit, offset }.
  Allowlisted ?sort=field / -field. PATCH is partial, Zod .strict(). Never return password_hash.

## Endpoints
- Auth: POST /auth/register, POST /auth/login, GET /auth/me
- Users: GET /users?search= (id, name, email only)
- Projects: GET/POST /projects, GET/PATCH/DELETE(archive) /projects/:id,
  POST /projects/:id/restore, GET /projects/:id/tree, GET /projects/:id/activity
- Members: GET/POST /projects/:id/members, PATCH/DELETE /projects/:id/members/:userId
- Stories: GET/POST /projects/:id/stories (?status&priority&assignee_id&sort),
  GET/PATCH/DELETE /stories/:id
- Tasks: GET/POST /stories/:id/tasks (?status&assignee_id), GET/PATCH/DELETE /tasks/:id,
  GET /me/tasks?overdue=true
- Notifications: GET /notifications?unread=true, POST /notifications/:id/read, POST /notifications/read-all
- Reports: POST /projects/:id/reports → 202 {jobId}, GET /reports/:jobId
- Admin: GET /admin/jobs?status=dead, POST /admin/jobs/:id/retry

## Security
- bcrypt cost 12, min password 8, never logged or returned. Generic login error message.
- Login rate limited (about 10 per 15 min per IP).
- JWT with expiry, secret from env (min 16 chars, validated at startup), .env git-ignored.
- Authorization on every route, no IDOR. Zod on body/params/query, max string lengths, 100kb body limit.
- Parameterized SQL only. helmet, CORS limited to CORS_ORIGIN. No stack traces to clients.
- No dangerouslySetInnerHTML. Token in memory + localStorage (document XSS vs cookie/CSRF tradeoff).
- Escape CSV cells starting with = + - @.
- Known gaps to document: no refresh tokens/revocation, no email verification, no lockout,
  SQLite not encrypted at rest.

## Frontend
- Routes: /login, /register, /projects, /projects/:id (hierarchy + board toggle), /dashboard.
  ProtectedRoute on all but auth pages.
- TanStack Query keys ['projects'], ['project', id, 'tree']; mutations invalidate; optimistic status changes.
- Notification bell polls every ~15s. Loading, empty, error states everywhere; show API field errors.
- Viewers see no write controls. Archived projects are read-only.

## Testing (10-15 tests, Supertest, fresh DB per file)
Auth (register, duplicate, wrong password, no token), IDOR (non-member 404, viewer 403),
story-done rule, archived write 409, cascade delete, validation 422, jobs (transactional enqueue,
exclusive claim, backoff, dead after max attempts, stuck-job recovery, duplicate key no-op),
2-3 frontend tests.

## Conventions
ES modules, small functions, no commented-out code, pino not console.log, never log secrets,
commits as type(scope): message, keep docs/decisions.md updated.

## Definition of done
Works end to end, validated, authorization checked, error envelope used, happy-path and
failure/permission test, documented in openapi.yaml, and I can explain every line.

## Rules for the AI
- One feature at a time. Show a plan and list files before editing.
- No new dependencies without asking. Don't touch files outside the task.
- Parameterized SQL in repositories only.
- Flag problems in this spec instead of silently working around them.
- After each change, say how to verify it. Explain non-obvious decisions in 1-2 lines.

## Status
- [x] Step 1: skeleton, tooling, spec
- [x] Step 2: config, DB, migrations, schema, error handling, /health
- [x] Step 3: auth API (register, login, /auth/me, JWT middleware, seed)
- [ ] Step 4: projects, members, stories, tasks, /tree, role checks
- [ ] Step 5: frontend setup, login/register, protected routes
- [ ] Step 6: frontend features (projects, hierarchy, forms, filters, board)
- [ ] Step 7: job queue, worker, handlers, scheduler, notifications, reports
- [ ] Step 8: tests, rate limiting, security review
- [ ] Step 9: OpenAPI, README, docs, Docker Compose, fresh-clone QA