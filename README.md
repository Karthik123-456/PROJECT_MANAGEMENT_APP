# Project Manager

Project Manager is a web app for organizing project work. Create projects, add
user stories and tasks, assign tasks to project members, and track progress
through task and story statuses. The app also provides in-app notifications for
completion activity and scheduled due-date reminders for assigned tasks.

The frontend is a React and TypeScript single-page app. The backend is an
Express API backed by SQLite. A separate background worker processes queued
notifications and periodically scans for due-date reminders.

## Prerequisites

- Node.js 22 LTS or newer and npm.
- On Windows, if `better-sqlite3` cannot install a prebuilt binary, install
  Visual Studio Build Tools with the **Desktop development with C++** workload
  and a Windows SDK.

## Local setup

Open PowerShell in the project root:

```powershell
Set-Location C:\path\to\agile-tool
```

Install backend dependencies and create its local environment file:

```powershell
Set-Location .\backend
npm ci
Copy-Item .env.example .env
```

Edit `backend\.env` and replace `JWT_SECRET` with a private random value of at
least 16 characters. Keep `.env` local; do not commit it.

Install frontend dependencies and create its optional environment file:

```powershell
Set-Location ..\frontend
npm ci
Copy-Item .env.example .env
```

Leave `VITE_API_URL` empty for local development. Vite proxies `/api` requests
to the backend at `http://localhost:4000`.

## Initialize the database

From the backend directory, run migrations and optionally add demo data:

```powershell
Set-Location ..\backend
npm run migrate
npm run seed
```

SQLite creates the database at `backend\data\app.db` by default. The seed
command creates local demo users and a sample project. It prints the demo
credentials; use them only for local development. Existing seeded users are
not updated by running the seed command again.

## Run the app

Start each process in its own terminal and leave all three running.

**Terminal 1 — backend API:**

```powershell
Set-Location C:\path\to\agile-tool\backend
npm run dev
```

**Terminal 2 — background worker:**

```powershell
Set-Location C:\path\to\agile-tool\backend
npm run worker
```

The worker processes notification jobs and schedules due-date scans. In-app
notifications are stored in the database; email delivery is simulated.

**Terminal 3 — frontend:**

```powershell
Set-Location C:\path\to\agile-tool\frontend
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser. The API is
available at `http://localhost:4000`, with health status at
`http://localhost:4000/health`.

See the [API guide](docs/api.md) for the API style, authentication, roles, and
endpoint reference. The machine-readable resource specification is
[`backend/openapi.yaml`](backend/openapi.yaml).
See the [architecture guide](docs/architecture.md) for component boundaries,
data flow, persistence, and background processing.
See the [database schema guide](docs/schema.md) for tables, relationships,
constraints, indexes, and migration practices, and the [security guide](docs/security.md)
for authentication, authorization, safeguards, and deployment responsibilities.
See [ROADMAP.md](ROADMAP.md) for proposed future improvements.
See [AI usage](docs/AI_usage.md) for how AI tools supported development.

## Verify changes

Run the backend checks from `backend`:

```powershell
npm test
npm run lint
```

Run the frontend checks from `frontend`:

```powershell
npm test
npm run lint
npm run build
```