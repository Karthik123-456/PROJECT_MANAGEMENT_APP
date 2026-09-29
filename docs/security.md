# Security

This document describes the security controls currently implemented by Project
Manager and the operational responsibilities for local development and
deployment. It is a summary of the application design, not a substitute for a
deployment-specific security assessment.

## Authentication and credentials

- Registration and login are protected by route-specific rate limits:
  registration allows up to 20 attempts per 15 minutes; login allows up to 10
  unsuccessful attempts per 15 minutes. Successful logins do not count toward
  the login limit.
- Passwords are hashed with bcrypt at cost 12. The database stores
  `password_hash`, not submitted plaintext passwords.
- Successful login and registration issue a signed JWT using HS256. Protected
  requests must send it as `Authorization: Bearer <token>`. The backend
  verifies the algorithm and signature, checks token claims, and loads the
  current account.
- JWT lifetime is configured with `JWT_EXPIRES_IN` (default `1h`).
- `JWT_SECRET` is required and must be at least 16 characters. Use a
  cryptographically random secret in any shared or deployed environment.
  Never put the backend secret in frontend configuration, source control,
  screenshots, logs, or support messages.
- The frontend keeps the token in memory and local storage when available.
  Local storage is accessible to same-origin JavaScript, so successful
  exploitation of an XSS flaw could expose a stored token. Restrict unsafe
  rendering, keep dependencies current, and apply an appropriate Content
  Security Policy at the hosting layer. An `httpOnly` cookie can reduce token
  theft from JavaScript, but requires CSRF protections and is not the current
  implementation.
- Logout clears the frontend token and cached data. The backend does not
  maintain a token revocation list; an issued JWT remains usable until it
  expires unless the signing secret is rotated or the user's account can no
  longer be loaded.

## Authorization and data boundaries

- Every protected API request authenticates the caller. Project APIs check
  project membership and role at the resource boundary.
- Owners, members, and viewers have different permissions. Viewers are
  read-only; owners perform project and membership administration. The exact
  matrix is in the [API guide](./api.md#project-roles-and-access).
- Notification endpoints only list or modify notifications belonging to the
  authenticated user.
- Admin job routes require both authentication and the administrator flag.
- Project resources that are not accessible to the caller are generally
  returned as `404`, limiting resource-existence disclosure. Insufficient role
  on an accessible resource returns `403`.
- Assignees must be project members; request validation and service-level
  checks enforce accepted IDs and business rules.

## Request and response safeguards

- Zod schemas validate request bodies, path parameters, and query parameters.
  Invalid input is returned as a structured `422 VALIDATION_ERROR`.
- JSON request bodies are limited to 100 KB. Malformed JSON returns a `400`
  error rather than reaching application handlers.
- Helmet sets common HTTP security headers.
- CORS is restricted to the configured `CORS_ORIGIN` (default
  `http://localhost:5173`); configure the exact trusted frontend origin for
  deployment.
- The API uses parameterized SQLite statements in repositories and returns
  safe user projections rather than password hashes.
- Unexpected server errors are logged server-side and returned to clients as a
  generic `500 INTERNAL_SERVER_ERROR`. Logs should still be treated as
  sensitive operational data and access should be restricted.

## Data and secrets handling

- Backend settings are read from `backend/.env` for local development. The
  checked-in `.env.example` is a template; copy it to `.env` and replace
  placeholder secrets locally. Do not commit `.env`, database files, or
  production credentials.
- SQLite stores password hashes, user data, project content, activity,
  notifications, and queued job payloads. Protect the database file and its
  `-wal` / `-shm` sidecars with appropriate filesystem permissions and backups.
- The app does not encrypt the SQLite database at rest. Use operating-system
  or volume-level encryption where required.
- Use HTTPS in any non-local deployment. The app's local HTTP development
  configuration does not itself provide TLS.
- Seed users and their printed passwords are for local demonstrations only.
  The seed script refuses to run when `NODE_ENV=production`; never use demo
  credentials for real accounts.
- Email delivery is simulated. No external email provider or delivery of
  secrets by email is configured.

## Operational notes and limitations

- Login and registration rate limiting is disabled when `NODE_ENV=test`; do
  not run the application with `NODE_ENV=test` as a production setting.
- Production deployments must set `NODE_ENV=production`, provide a strong
  secret, configure the trusted CORS origin, use TLS, and protect access to
  environment variables and database storage.
- The Vite `/api` proxy is for development only. Production hosting must route
  API requests safely to the backend.
- The app uses bearer JWTs rather than cookie sessions, so it does not use
  cookie-based CSRF tokens. If authentication is migrated to cookies, add and
  validate CSRF protections.
- Background-job payloads and `last_error` values are persisted in the
  database. Avoid placing passwords, JWTs, or other secrets in job payloads or
  error messages.
- Keep Node.js and dependencies patched. Review dependency audit output and
  investigate advisories that affect the deployed dependency tree.