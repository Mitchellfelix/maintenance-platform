# Deploy EMAT on Railway (always-on team host)

Your Mac is **not** required for teammates. Railway runs the app + Postgres 24/7.

## One-time setup

### 1. Railway project

1. Create an account at [railway.app](https://railway.app) and install the CLI:
   ```bash
   npm install -g @railway/cli
   railway login
   ```
2. From this repo:
   ```bash
   cd ~/maintenance-platform
   railway init          # or: railway link
   ```
3. In the Railway dashboard for the project:
   - **Add Postgres** (plugin) — shares `DATABASE_URL` with the web service
   - **Add a web service** from this GitHub repo (or `railway up`) using the root `Dockerfile` / [`railway.toml`](../railway.toml)

### 2. Volume (uploads + Mac zip)

On the **web service** → Volumes → add volume mounted at:

```text
/data
```

Set variables on the web service:

| Variable | Value |
|----------|--------|
| `JWT_SECRET` | long random string |
| `EMAT_APP_URL` | `https://YOUR-APP.up.railway.app` |
| `APP_URL` | same as `EMAT_APP_URL` |
| `CORS_ORIGIN` | `true` |
| `EMAT_DATA_DIR` | `/data` |
| `HOST` | `0.0.0.0` |
| `DATABASE_URL` | *(from Postgres plugin — auto)* |

Generate a public HTTPS domain under Settings → Networking → Generate Domain.

### 3. Deploy

```bash
railway up
# or push to GitHub if the service is connected to the repo
```

Confirm:

```bash
curl -fsS https://YOUR-APP.up.railway.app/api/health/db
curl -fsS -o /dev/null -w "%{http_code}\n" https://YOUR-APP.up.railway.app/join
```

### 4. Migrate local data → Railway

With local Docker Postgres running (your current data):

```bash
railway link    # select the project / web service
EMAT_CONFIRM_MIGRATE=YES npm run railway:migrate
# include greentag photos:
EMAT_CONFIRM_MIGRATE=YES EMAT_MIGRATE_UPLOADS=1 npm run railway:migrate
```

Or set the URL explicitly:

```bash
EMAT_CONFIRM_MIGRATE=YES RAILWAY_DATABASE_URL='postgresql://…' npm run railway:migrate
```

### 5. Publish Mac download

```bash
npm run railway:publish-mac
```

This packages the Electron zip and streams it to `/data/downloads/EMAT-mac.zip` on the volume.

### 6. Tell the team

Send only:

```text
https://YOUR-APP.up.railway.app/join
```

Browser play or Terminal:

```bash
curl -fsSL "https://YOUR-APP.up.railway.app/install-mac" | bash
```

## After go-live

- Turn off laptop hosting: `npm run team:autostart:off`
- Stop local stack if unused: `docker compose --profile team down` (do **not** use `-v`)
- Redeploying the web service keeps `/data` (uploads + Mac zip) when the volume is attached

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Healthcheck failing | Wait for migrations; check `DATABASE_URL` is linked from Postgres |
| `/join` works but Mac download missing | `npm run railway:publish-mac` |
| Photos missing after migrate | `npm run railway:publish-uploads` |
| Wrong Team URL in Mac app | Ensure `EMAT_APP_URL` matches the public HTTPS domain |
