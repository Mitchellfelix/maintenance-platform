# Maintenance Platform

Standalone maintenance platform app with:

- `client/` React + Vite frontend
- `server/` Express + Prisma backend
- PostgreSQL database via Prisma migrations

## Team setup (shared URL)

For one database and one URL for the whole team, see **[docs/TEAM-SETUP.md](docs/TEAM-SETUP.md)**.

Quick version:

```bash
# Host
npm run team:serve          # prints Team URL, e.g. http://192.168.1.50:3000

# Each team member
npm run team:connect -- http://192.168.1.50:3000
emat
```

## Local setup

### 1. Install dependencies

```bash
cd ~/maintenance-platform
npm install
```

### 2. Start PostgreSQL (Docker)

If you don't have PostgreSQL installed locally, use the included Docker Compose file:

```bash
docker compose up -d
```

This starts Postgres on port `5432` with:

- user: `maintenance`
- password: `maintenance`
- database: `maintenance_platform`

### 3. Configure environment

```bash
cp server/.env.example server/.env
```

The example matches the Docker Compose database. Edit `JWT_SECRET` if needed.

### 4. Run migrations and start the app

```bash
npm run db:deploy
npm run dev
```

Open **http://localhost:5173** in your browser.

- Frontend (dev): http://localhost:5173
- Backend API: http://localhost:3000
- Health check: http://localhost:3000/api/health/db

Register at `/login`, then create sites, assets, and work orders. Admins can also **add users** or **send invites** from **User access**.

### Access request alerts (optional)

Configure Resend **or** SMTP plus optional Slack in `server/.env` (see `server/.env.example`). With mail configured, EMAT emails ACTIVE Admin/Ops Lead users on new access requests (and optional Slack), emails requesters when approved, emails users when an admin creates their account or they accept an invite, and sends password-reset links from **Forgot password?** on the sign-in page.

## Frontend

The React app includes:

- **Navigation shell** — sidebar with Dashboard, Sites, Assets, Work Orders
- **Auth** — sign in / register at `/login`; JWT stored in localStorage
- **Dashboard** — metrics, recent assets, recent work orders (read-only)
- **Sites / Assets / Work Orders** — list views, inline create forms (when signed in), detail pages with edit and delete

You must sign in to use the app. Unauthenticated visits are redirected to `/login`.

## Production build

```bash
npm install
npm run build
npm start
```

Open **http://localhost:3000**. Express serves the compiled app plus `/api/*` routes.

## API routes

### Health
- `GET /api/health`
- `GET /api/health/db`

### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me` (Bearer token required)

### Sites
- `GET /api/sites`
- `GET /api/sites/:id`
- `POST /api/sites` (auth required)
- `PATCH /api/sites/:id` (auth required)
- `DELETE /api/sites/:id` (auth required)

### Assets
- `GET /api/assets`
- `GET /api/assets/:id`
- `POST /api/assets` (auth required)
- `PATCH /api/assets/:id` (auth required)
- `DELETE /api/assets/:id` (auth required)

### Work orders
- `GET /api/workorders`
- `GET /api/workorders/:id`
- `POST /api/workorders` (auth required; `code` and `requesterId` set server-side)
- `PATCH /api/workorders/:id` (auth required)
- `DELETE /api/workorders/:id` (auth required)

## Testing

Integration tests wipe **all rows** between cases. They must never use your live database.

```bash
# 1. Copy env and keep the `_test` database name
cp server/.env.test.example server/.env.test

# 2. Create the test database (Docker Postgres example)
docker compose up -d db
docker compose exec db psql -U maintenance -d maintenance_platform -c \
  "CREATE DATABASE maintenance_platform_test;"

# 3. Apply migrations to the test DB only
cd server
DATABASE_URL="postgresql://maintenance:maintenance@localhost:5432/maintenance_platform_test" npm run db:deploy
npm test
```

Guards reject any test `DATABASE_URL` that does not end in `_test` (and refuse `maintenance_platform`). Without `server/.env.test`, DB tests are skipped — they no longer fall back to `server/.env`.

## Data durability

EMAT treats your database as durable production data.

| Command | Purpose |
|---------|---------|
| `npm run db:backup` | Snapshot Postgres → `backups/emat-*.sql.gz` (keeps last ~40) |
| `npm run db:deploy:safe` | Backup **then** apply migrations |
| `EMAT_CONFIRM_RESTORE=YES npm run db:restore -- --latest` | Restore from newest backup |

Desktop launch and `team:serve` also take a backup before schema updates when Docker is up.

**Hard rules**

- Docker Postgres uses named volume `maintenance_platform_pgdata` — survives normal restarts.
- Never run `docker compose down -v` (destroys the volume).
- Never point tests at `maintenance_platform` — use `maintenance_platform_test` only (`server/.env.test`).
- `db:push` / interactive `db:migrate` are blocked unless `EMAT_ALLOW_DESTROY_DATA=YES` **and** the DB name ends with `_test`.
- Prefer `npm run db:deploy:safe` over raw migrate on machines with real data.

## Crash resilience

- Desktop Electron polls `/api/health/db` and restarts the local stack if it goes down
- Renderer crashes reload the window; a React ErrorBoundary offers **Reload app**
- API maps DB connection failures to HTTP 503; fatal Node errors exit so supervisors can restart
- Team Docker: Postgres + app use `restart: unless-stopped` with DB/app healthchecks
- Backups remain the recovery path if something still goes wrong — run `npm run db:backup` after important data entry


## Docker (full app)

```bash
docker build -t maintenance-platform .
docker run --env-file server/.env -p 3000:3000 maintenance-platform
```

The app container still needs a reachable PostgreSQL instance via `DATABASE_URL`.
