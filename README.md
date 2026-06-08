# Maintenance Platform

Standalone maintenance platform app with:

- `client/` React + Vite frontend
- `server/` Express + Prisma backend
- PostgreSQL database via Prisma migrations

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

Register at `/login`, then create sites, assets, and work orders.

## Frontend

The React app includes:

- **Navigation shell** — sidebar with Dashboard, Sites, Assets, Work Orders
- **Auth** — sign in / register at `/login`; JWT stored in localStorage
- **Dashboard** — metrics, recent assets, recent work orders (read-only)
- **Sites / Assets / Work Orders** — list views, inline create forms (when signed in), detail pages with edit and delete

Browse data without signing in. Create, edit, and delete require an authenticated session.

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

Integration tests require a PostgreSQL test database:

```bash
cp server/.env.test.example server/.env.test
# edit DATABASE_URL for a dedicated test database
cd server
npm run db:deploy
npm test
```

Tests are skipped automatically when `DATABASE_URL` is not configured.

## Docker (full app)

```bash
docker build -t maintenance-platform .
docker run --env-file server/.env -p 3000:3000 maintenance-platform
```

The app container still needs a reachable PostgreSQL instance via `DATABASE_URL`.
