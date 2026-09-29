## Frontend session and redirects

- Tokens use memory plus `localStorage` (`agile.token`) for persistence across reloads. Unlike an `httpOnly` cookie, localStorage is readable by injected JavaScript and increases XSS token-theft risk; an `httpOnly` cookie reduces that exposure but requires CSRF defenses.
- Startup clears a saved token only when `/auth/me` returns 401. Network, invalid-response, and server errors retain the token and show an unavailable/retry screen.
- Post-login return targets must be internal paths beginning with one `/`; protocol-relative (`//...`) and scheme-based targets fall back to `/projects`.

## Completion notification jobs

- Task and story completion outbox rows are inserted inside the same immediate transaction as the status change. Each genuine transition into `done` gets a new timestamp-and-UUID job idempotency key, so reopening and completing the same item can notify again.
- A notification reuses its job's persisted idempotency key. Worker delivery is at-least-once: if a process crashes after the notification transaction commits but before the job is marked succeeded, a retry attempts the insert again and the unique key prevents a duplicate notification row.
- Notification creation is limited to member-initiated task/story completion. Owner-completed work does not enqueue a notification; assignment and other status notifications remain out of scope for this phase.