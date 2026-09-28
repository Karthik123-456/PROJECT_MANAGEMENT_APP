## Frontend session and redirects

- Tokens use memory plus `localStorage` (`agile.token`) for persistence across reloads. Unlike an `httpOnly` cookie, localStorage is readable by injected JavaScript and increases XSS token-theft risk; an `httpOnly` cookie reduces that exposure but requires CSRF defenses.
- Startup clears a saved token only when `/auth/me` returns 401. Network, invalid-response, and server errors retain the token and show an unavailable/retry screen.
- Post-login return targets must be internal paths beginning with one `/`; protocol-relative (`//...`) and scheme-based targets fall back to `/projects`.