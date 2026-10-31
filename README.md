# Developer's Project Timer

Touch-friendly developer project timer for a 1920×720 / 12.3" display. Vite + React SPA, Node API, SQLite persistence.

## Features (v1)

- **Buckets:** Closed · Open · Future — create in any, move via edit
- **Timers:** Large tap targets; tap to start/pause; totals persist and resume
- **Sessions:** Info button → start/end history; periods are editable
- **Calendar:** Default M–F 8:30 AM–5:00 PM (America/Chicago, 12-hour labels); grid expands only when sessions fall outside that window; browse past weeks; sprint markers (Wed–Tue, Q4 Sprint 3 starts 2026-11-04)
- **Hierarchy:** Epic | Feature | User Story | Task | Other; Features/Stories/Tasks can link to an Epic / project number
- **Time display:** Timer totals are whole minutes (HH:MM); calendar uses 12-hour times (e.g. 8:30 AM)
- **Settings:** Allow multiple active timers (default off — single-active enforced)
- **Theme:** Dark default with light/dark toggle
- **Auth:** Single-user, no login; `users` table reserved for salted password hashes later

## Quick start (npm)

```bash
npm run install:all
npm run dev
```

- UI: http://localhost:5173 (proxies `/api` → API)
- API: http://localhost:8787

Production-style local run:

```bash
npm run install:all
npm run build
npm start
```

Then open http://localhost:8787

SQLite file defaults to `./data/timer.db` (override with `DATA_DIR`).

## Docker

```bash
docker compose up --build
```

App: http://localhost:8787  
Data volume: `timer-data` → `/data/timer.db`

## API sketch

| Method | Path | Notes |
|--------|------|-------|
| GET/PATCH | `/api/settings` | `allowMultipleActive` |
| GET/POST | `/api/timers` | CRUD + bucket filter |
| PATCH/DELETE | `/api/timers/:id` | |
| POST | `/api/timers/:id/start\|pause` | |
| GET | `/api/timers/:id/sessions` | |
| POST/PATCH/DELETE | `/api/sessions` | editable periods |
| GET | `/api/calendar/sessions?start=&end=` | |

## Architecture

- `client/` — Vite + React + TypeScript
- `server/` — Express + better-sqlite3
- `server/src/repository.js` — data access layer (swap SQLite later without touching routes)
- `server/src/db.js` — schema + `users` extension point for future auth

## License

MIT
