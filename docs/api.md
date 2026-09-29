# Project Manager API

## Overview

Project Manager exposes a **REST-style HTTP API** that exchanges JSON. REST
organizes operations around resources such as projects, stories, tasks, members,
and notifications. The API uses standard HTTP methods:

- `GET` reads resources.
- `POST` creates resources or performs actions such as marking notifications
  read.
- `PATCH` updates selected fields.
- `DELETE` removes or archives a resource.

This style is a good fit for the app because its browser frontend performs
ordinary create, read, update, and delete operations on these resources. Using
standard HTTP methods and JSON keeps the interface straightforward to call from
the React frontend, test independently, and use from tools such as `curl` or an
HTTP client. It is not a GraphQL or gRPC API.

The API is versioned under `/api/v1`. The local backend defaults to
`http://localhost:4000`, so the full local API base URL is
`http://localhost:4000/api/v1`. In local frontend development, Vite proxies
requests from `/api` to the backend.

The backend also exposes `GET /health` outside the versioned API. It returns
`{"status":"ok"}` when the server can check the database.

## Content and common response behavior

Send JSON request bodies with `Content-Type: application/json`; successful
responses with a body are JSON. A successful `DELETE` may return `204 No
Content`, which has no response body.

Paginated list responses use this shape:

```json
{
  "data": [],
  "total": 0,
  "limit": 20,
  "offset": 0
}
```

List endpoints that support pagination accept `limit` (1–100, default 20) and
`offset` (0 or greater, default 0). Endpoint-specific filters are listed below.

Errors use a common envelope:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      { "path": "email", "message": "Invalid email" }
    ]
  }
}
```

`details` may be `null` or an array of validation issues. Common HTTP statuses:

| Status | Meaning |
| --- | --- |
| `400` | Malformed JSON request body (`BAD_JSON`) |
| `401` | Missing, invalid, or expired authentication |
| `403` | Authenticated user lacks permission |
| `404` | Route or resource not found (or inaccessible project resource) |
| `409` | Conflict, such as duplicate email or a change disallowed by current state |
| `422` | Invalid request input; field issues are included in `details` |
| `429` | Rate limit exceeded, primarily registration and login |
| `500` | Unexpected server error (`INTERNAL_SERVER_ERROR`) |

The error `code` is the stable identifier for application behavior; the
human-readable `message` may be shown to a user.

## Authentication

Authentication uses **Bearer tokens implemented as signed JWTs**. The backend
issues a token after successful registration or login. For protected endpoints,
send it in the HTTP `Authorization` header:

```http
Authorization: Bearer <token>
```

JWTs are used here to authenticate API requests without requiring a server-side
session for each browser request. The backend verifies the signature and
expiration, then loads the current user before authorizing the operation. The
signing secret and expiry are configured on the backend using `JWT_SECRET` and
`JWT_EXPIRES_IN`. Keep the secret private; never send it to the frontend or
include it in source control.

The frontend stores the issued token in memory and local storage. Local storage
is readable by JavaScript running on the site, so an XSS flaw could expose it.
An `httpOnly` cookie is an alternative, but requires suitable CSRF protections.

Registration and login are public endpoints. Other `/api/v1` endpoints below
require a valid Bearer token unless explicitly marked otherwise.

### Authentication endpoints

#### `POST /auth/register`

Creates an account and returns the new user and token (`201 Created`).

```json
{
  "email": "user@example.com",
  "name": "Taylor",
  "password": "a-password-at-least-8-characters"
}
```

Email is normalized to lowercase. Name must be 1–100 characters. Passwords
must be 8–72 UTF-8 bytes. Returns `409 EMAIL_TAKEN` if the email is already
registered and `429 RATE_LIMITED` if the registration limit is exceeded.

#### `POST /auth/login`

Checks credentials and returns the user and token (`200 OK`).

```json
{
  "email": "user@example.com",
  "password": "your-password"
}
```

Invalid credentials return `401 INVALID_CREDENTIALS`. Login is rate limited;
exceeding the limit returns `429 RATE_LIMITED`.

#### `GET /auth/me`

Returns the current authenticated user:

```json
{
  "user": {
    "id": 12,
    "email": "user@example.com",
    "name": "Taylor",
    "is_admin": false,
    "created_at": "2026-09-29T00:00:00.000Z"
  }
}
```

### Example: use the token

With `curl` (replace the token with the value returned by registration or
login):

```sh
curl http://localhost:4000/api/v1/projects \
  -H "Authorization: Bearer <token>"
```

In PowerShell, use `curl.exe` if `curl` resolves to the PowerShell web-request
alias.

## Project roles and access

Project membership roles are `owner`, `member`, and `viewer`.

| Capability | Owner | Member | Viewer |
| --- | :---: | :---: | :---: |
| Read project, members, activity, stories, and tasks | Yes | Yes | Yes |
| Create or update stories | Yes | Yes | No |
| Create or update tasks | Yes | Yes | No |
| Delete tasks | Yes | Yes | No |
| Update/archive/restore project | Yes | No | No |
| Add, change, or remove project members | Yes | No | No |
| Delete stories | Yes | No | No |

Archived projects are read-only; attempted writes return `409
PROJECT_ARCHIVED`. The API scopes project resources to the authenticated user's
membership.

## Endpoint reference

All paths in this section are relative to `/api/v1`. Unless otherwise noted,
they require a Bearer token.

### Projects and membership

| Method and path | Purpose | Access |
| --- | --- | --- |
| `GET /projects` | List projects the caller belongs to. Filters: `status=active\|archived`; pagination supported. | Authenticated user |
| `POST /projects` | Create a project; caller becomes its owner. Body: `{ "name": "...", "description": "..." }`. | Authenticated user |
| `GET /projects/{id}` | Read a project and caller's role. | Project member |
| `PATCH /projects/{id}` | Update project name/description. Body must include at least one field. | Owner |
| `DELETE /projects/{id}` | Archive a project; returns `204`. | Owner |
| `POST /projects/{id}/restore` | Restore an archived project. | Owner |
| `GET /projects/{id}/members` | List project members; pagination supported. | Project member |
| `POST /projects/{id}/members` | Add a member or viewer. Body: `{ "email": "...", "role": "member" }`. | Owner |
| `PATCH /projects/{id}/members/{userId}` | Change role to `member` or `viewer`. | Owner |
| `DELETE /projects/{id}/members/{userId}` | Remove a member; returns `204`. | Owner |
| `GET /projects/{id}/activity` | List recent project activity; pagination supported. | Project member |
| `GET /users?search=...` | Search users by name or email; search must be 2–100 characters. | Authenticated user |

Project names are 1–100 characters; descriptions may be `null` and are limited
to 5,000 characters.

### Stories and tasks

| Method and path | Purpose | Access |
| --- | --- | --- |
| `GET /projects/{id}/tree` | Get project, stories, progress, and nested tasks. | Project member |
| `GET /projects/{id}/stories` | List stories. Optional filters: `status`, `priority`, `assignee_id`, and `sort`; pagination supported. | Project member |
| `POST /projects/{id}/stories` | Create a story. Required: `title`; optional description, acceptance criteria, status, priority, story points, and assignee. | Owner or member |
| `GET /stories/{id}` | Read a story. | Project member |
| `PATCH /stories/{id}` | Update one or more story fields. | Owner or member |
| `DELETE /stories/{id}` | Delete a story and its tasks; returns `204`. | Owner |
| `GET /stories/{id}/tasks` | List tasks. Optional filters: `status`, `assignee_id`; pagination supported. | Project member |
| `POST /stories/{id}/tasks` | Create a task. Required: `title`; optional description, status, assignee, estimate, and due date. | Owner or member |
| `GET /tasks/{id}` | Read a task. | Project member |
| `PATCH /tasks/{id}` | Update task fields, including status, assignee, estimate, due date, and position. | Owner or member |
| `DELETE /tasks/{id}` | Delete a task; returns `204`. | Owner or member |
| `GET /me/tasks` | List the caller's assigned tasks. Optional filters: `status`, `overdue`; pagination supported. | Authenticated user |

Story statuses: `backlog`, `in_progress`, `in_review`, `done`. Story priorities:
`low`, `medium`, `high`. Task statuses: `todo`, `in_progress`, `done`.
`assignee_id` may be `null`. Task `due_date` is a calendar date in
`YYYY-MM-DD` format or `null`.

Completing a task or story may enqueue an in-app notification for the project
owner when the actor is not the owner. Due reminders are generated by the
background worker for assigned, non-done tasks and are sent to the assignee.

### Notifications

| Method and path | Purpose |
| --- | --- |
| `GET /notifications` | List the caller's notifications. Optional `unread=true\|false`; pagination supported. |
| `POST /notifications/{id}/read` | Mark one of the caller's notifications as read. |
| `POST /notifications/read-all` | Mark all of the caller's notifications as read. |

Notification types include `task_completed`, `story_completed`,
`task_due_soon`, and `task_overdue`. Notification routes only operate on the
authenticated user's own notifications.

### Administration

| Method and path | Purpose | Access |
| --- | --- | --- |
| `GET /admin/jobs` | List background jobs. Optional `status` (`pending`, `running`, `succeeded`, `dead`); pagination supported. Defaults to `dead`. | Administrator |
| `POST /admin/jobs/{id}/retry` | Retry a dead job. | Administrator |

## OpenAPI specification

The machine-readable OpenAPI 3.0 specification is
[`backend/openapi.yaml`](../backend/openapi.yaml). This guide also documents
authentication and the health check, which are not currently listed as paths
in that specification. Keep the guide and specification aligned when API
routes or request/response contracts change.
