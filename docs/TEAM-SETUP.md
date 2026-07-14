# EMAT — Team setup (download & go)

One shared **cloud** server and database. Teammates do **not** need git, Node, Docker, or your laptop.

| Role | What they do | Result |
|------|----------------|--------|
| **Host (you)** | Deploy once on [Railway](./RAILWAY.md) | Share the HTTPS **Join** link |
| **Team member** | Open Join → browser or Mac install | Same data as everyone else |

Primary guide: **[RAILWAY.md](./RAILWAY.md)**.

---

## Part 1 — Host: Railway (always on)

```bash
npm install -g @railway/cli
railway login
railway link          # after creating the project + Postgres in the dashboard
# Set JWT_SECRET, EMAT_APP_URL, CORS_ORIGIN=$EMAT_APP_URL, EMAT_DATA_DIR=/data
# Mount volume at /data — see RAILWAY.md

railway up
EMAT_CONFIRM_MIGRATE=YES npm run railway:migrate
npm run railway:publish-mac
```

Send your team:

```text
https://YOUR-APP.up.railway.app/join
```

After go-live, local LAN hosting is optional only (see bottom).

---

## Part 2 — Team members

### A. Browser (fastest)

1. Open `https://YOUR-APP.up.railway.app/join`
2. Click **Play in this browser**
3. Sign in or **Request access**

### B. Mac desktop app

1. Open the Join link
2. Click **Copy** on the Terminal command (or paste):

   ```bash
   curl -fsSL "https://YOUR-APP.up.railway.app/install-mac" | bash
   ```

3. Sign in or **Request access**

Daily: open **EMAT Tracking Database** from Applications, or bookmark the Join / app URL.

---

## Online + offline sync

The Mac desktop app supports both modes:

| Mode | Behavior |
|------|----------|
| **Offline / local** | Local Docker Postgres on that Mac (`npm run app:install` once). Works without the network. |
| **Online / team** | Connects to the Railway Team URL. |

**Sync (Help → Sync now…)** merges both databases using **newest update wins** for:

- Sites, assets, work orders, hours, inventory
- Greentagging jobs / cases / checklist steps
- Green Tagging Procedures (standalone checklists)

Not synced yet: photos, SOPs, audit log, access requests. Use the **same email/password** on local and team.

```text
1. Work offline (or on team) as usual
2. When both sides are reachable: Help → Sync now…
3. Sign in once → changes flow both directions
```

### Access

1. First user on an empty database can register and sign in immediately.
2. Later users: **Request access** on the login page → admin approves under **Access requests**.
3. Promote admin (against Railway DB):

   ```bash
   RAILWAY_DATABASE_URL='postgresql://…' node scripts/promote-admin.js user@company.com
   ```

   (Or `railway run node scripts/promote-admin.js user@company.com` from a linked clone.)

### Optional: email + Slack

On the Railway web service variables:

```bash
APP_URL=https://YOUR-APP.up.railway.app
EMAT_APP_URL=https://YOUR-APP.up.railway.app
# RESEND_API_KEY=…
# MAIL_FROM=…
# SLACK_WEBHOOK_URL=…
```

---

## Copy-paste handoff (send this to your team)

```text
EMAT Tracking Database — join the team

1. Open: https://YOUR-APP.up.railway.app/join
2. Fastest: click “Play in this browser”
3. Mac app: copy the Terminal command from that page, or:

   curl -fsSL "https://YOUR-APP.up.railway.app/install-mac" | bash

   Sign in → Request access if first time.
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Cannot reach Join link | Confirm Railway service is online; use the HTTPS domain from Networking |
| No Mac download | Host runs `npm run railway:publish-mac` |
| App can’t reach server | Team URL must be the HTTPS origin (no `/join`) |
| Old UI after update | Redeploy Railway web service (GitHub push or `railway up`) |
| Photos missing | `npm run railway:publish-uploads` |

Full Railway runbook: [RAILWAY.md](./RAILWAY.md).

---

## Emergency / local-only hosting (not for teammates)

If Railway is unavailable and you need a temporary LAN host:

```bash
npm run team:serve          # Docker app + DB on this Mac
npm run team:autostart      # KeepAlive on login (laptop must stay awake)
```

Share `http://YOUR-LAN-IP:3000/join` only on the same network. Prefer Railway for anything lasting.

Stop local host: `npm run team:autostart:off` and `docker compose --profile team down`.

---

## Advanced / developers

```bash
git clone https://github.com/Mitchellfelix/maintenance-platform.git
cd maintenance-platform
npm run team:connect -- https://YOUR-APP.up.railway.app
emat
```

| Mode | Command | URL |
|------|---------|-----|
| **Team (shared DB)** | Railway deploy · Members: Join link | `https://….up.railway.app` |
| **Solo (local DB)** | `npm run app:install` then `emat` | http://localhost:3000 |
