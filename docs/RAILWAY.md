# Deploy EMAT on Railway (always-on team host)

Your Mac is **not** required for teammates. Railway runs the app + Postgres 24/7.

## One-time setup

### 1. Railway project (dashboard — recommended)

1. Sign in at [railway.app](https://railway.app)
2. **New Project** → **Deploy from GitHub repo** → `Mitchellfelix/maintenance-platform` (branch `main`)
3. After the first service appears, **Add Postgres** and ensure `DATABASE_URL` is available to the web service
4. Continue with volume + variables below, then redeploy

CLI alternative (after `npm install -g @railway/cli`):

```bash
railway login
railway init
railway up
```

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
| `CORS_ORIGIN` | same as `EMAT_APP_URL` (comma-separated allowlist if needed) |
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

### 6. Email notifications (recommended)

Without these variables, access-request / approval emails are skipped.

1. Create a free [Resend](https://resend.com) account and API key.
2. Set a From address Resend will accept (for quick testing: their `onboarding@resend.dev`; for real teammates: verify your domain in Resend).
3. On the **emat** web service → Variables:

| Variable | Example |
|----------|---------|
| `RESEND_API_KEY` | `re_xxxxxxxx` |
| `MAIL_FROM` | `EMAT <onboarding@resend.dev>` or `EMAT <notifications@yourdomain.com>` |
| `EMAT_APP_URL` / `APP_URL` | `https://emat-production.up.railway.app` (already set) |

Redeploy (or let Railway auto-redeploy on variable change).

What gets emailed once configured:
- **Admins / Ops leads** — new access request
- **Requester** — when you approve (or when an admin creates their account)
- Password-reset emails when that flow is used

Optional Slack (access requests only): `SLACK_WEBHOOK_URL=…`

### 7. Tell the team

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
