# Project Manager

Project Manager is a web app for organizing project work. Create projects, add
user stories and tasks, assign tasks to project members, and track progress
through task and story statuses. The app also provides in-app notifications for
completion activity and scheduled due-date reminders for assigned tasks.

The frontend is a React and TypeScript single-page app. The backend is an
Express API backed by SQLite. A separate background worker processes queued
notifications and periodically scans for due-date reminders.

## Clone and enter the project

Clone the repository, then change into the folder Git created for it:

```bash
git clone <repository-url>
cd <repository-folder>
```

Replace `<repository-url>` with the repository's URL and `<repository-folder>`
with the folder name created by `git clone` (usually the repository name).

## Prerequisites

- Node.js 22 LTS or newer and npm.
- On Windows, if `better-sqlite3` cannot install a prebuilt binary, install
  Visual Studio Build Tools with the **Desktop development with C++** workload
  and a Windows SDK.

## Local setup

From the project root, install dependencies and create the local environment
files. Run these setup commands once:

```bash
cd backend
npm ci
cp .env.example .env
cd ../frontend
npm ci
cp .env.example .env
```

Edit `backend/.env` and replace `JWT_SECRET` with a private random value of at
least 16 characters. Keep `.env` local; do not commit it.

Leave `VITE_API_URL` empty for local development. Vite proxies `/api` requests
to the backend at `http://localhost:4000`.

## Initialize the database

From the project root, initialize the database and optionally add demo data:

```bash
cd backend
npm run migrate
npm run seed
cd ..
```

SQLite creates the database at `backend/data/app.db` by default. The seed
command creates local demo users and a sample project. It prints the demo
credentials; use them only for local development. Existing seeded users are
not updated by running the seed command again.

## Run the app

Open three terminals in the project root and leave all three processes
running. In each terminal, run the corresponding commands:

**Terminal 1 — backend API:**

```bash
cd backend
npm run dev
```

**Terminal 2 — background worker:**

```bash
cd backend
npm run worker
```

The worker processes notification jobs and schedules due-date scans. In-app
notifications are stored in the database; email delivery is simulated.

**Terminal 3 — frontend:**

```bash
cd frontend
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

```bash
cd backend
npm test
npm run lint
```

Run the frontend checks from `frontend`:

```bash
cd frontend
npm test
npm run lint
npm run build
```