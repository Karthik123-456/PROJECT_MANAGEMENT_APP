# Project Manager Roadmap

This roadmap lists potential improvements to pursue as time and project
priorities allow. These are proposals, not commitments or features that are
already implemented. Sequence and scope may change based on user feedback.

## 1. Kanban board

Add a board view to help teams see and manage work as it moves through
statuses.

- Show tasks in status columns: **To do**, **In progress**, and **Done**.
- Support moving a task between columns, with the change saved through the
  existing task API and permission rules.
- Keep the board synchronized with task lists and project detail views.
- Include useful filters such as assignee and story, plus clear empty and
  loading states.
- Make the board usable with a keyboard and on narrow screens; drag-and-drop
  should not be the only way to change status.

## 2. Scrum planning tools

Extend project planning with an optional Scrum workflow.

- Add sprint planning with sprint name, goal, start date, end date, and
  lifecycle state.
- Let project members plan stories and tasks into a sprint and move unfinished
  work back to the backlog when a sprint closes.
- Provide a sprint backlog and a sprint board without removing the existing
  project and task workflows.
- Add a sprint progress or burndown view only when its calculations can be
  explained and verified from recorded work and dates.
- Preserve project role permissions and define how viewers access sprint
  information.

This feature requires new sprint data and a database migration. It should be
designed so projects that do not use Scrum can continue with the current
workflow.

## 3. Owner-facing project reports

Provide project owners with an accurate, shareable summary based on persisted
project data—not a report that implies an action was performed by the owner.

Potential report contents:

- Reporting period and generation timestamp.
- Story and task totals by status, and overall completion progress.
- Open, completed, and overdue work, with due dates and assignees.
- Work completed during the selected period and upcoming due work.
- Sprint results and planned-versus-completed work when Scrum support exists.

Reports should identify their data source and time range, use consistent
definitions for metrics, and be tested against known sample data. Consider
CSV download first, followed by a print-friendly or PDF format if needed.
Restrict report generation and access to project owners unless product
requirements explicitly extend that permission.

## 4. Time-aware reminders

The current task due date is a calendar date (`YYYY-MM-DD`), and due reminders
are calculated using UTC calendar dates. Improve reminders to work at a
specific time, not only a date:

- Decide whether each task has a due time and which timezone applies (for
  example, a project timezone or the assignee's timezone).
- Store an unambiguous due instant (UTC) and retain the relevant timezone for
  display and scheduling. Add a migration and define how existing date-only
  tasks are converted.
- Let users choose reminder lead times, such as a configurable number of
  minutes or hours before a deadline.
- Send reminders at the configured time and define how overdue reminders are
  repeated or stopped.
- Confirm recipients and preferences—for example, whether reminders go to the
  assignee only, or whether owners can opt in.
- Test timezone boundaries, daylight-saving changes, edits to due times,
  completed tasks, unassigned tasks, retries, and duplicate scheduler runs.

## 5. Quality and usability improvements

- Continue improving responsive layouts, keyboard support, and screen-reader
  feedback across project, board, and reporting views.
- Add end-to-end smoke tests for registration/login, project permissions,
  task updates, and notification delivery.
- Add CI checks for backend tests/lint and frontend tests/lint/build.
- Review performance and database indexes as real project data grows.
- Add deployment and backup guidance before using the app with important
  shared data.

## Suggested order

1. Establish CI and end-to-end smoke coverage.
2. Deliver a keyboard-accessible Kanban board using the current task model.
3. Add Scrum/sprint data and planning flows.
4. Build owner-facing reports, then include sprint metrics.
5. Introduce time-aware due dates and configurable reminder preferences.

The order is a starting point, not a fixed commitment. Time-aware reminders
require a data-model decision and migration; reporting should follow agreement
on metric definitions so the results remain accurate and trustworthy.