# EMAT — Team setup (download & go)

One shared server and database. Teammates **do not** need git, Node, or Docker.

| Role | What they do | Result |
|------|----------------|--------|
| **Host (you)** | `npm run team:serve` | Share the **Join link** |
| **Team member** | Open Join link → browser or Download for Mac | Same data as everyone else |

---

## Part 1 — Host: start the shared server

**Requirements:** Docker Desktop, this repo on the host Mac.

```bash
cd ~/maintenance-platform
cp server/.env.example server/.env   # if you have not already
# Edit server/.env and set a strong JWT_SECRET

npm run team:serve
```

The script packages the Mac app on first run (if needed), starts the stack, and prints:

```text
Send your team this Join link:
  http://192.168.x.x:3000/join
```

**Keep the host machine running** (or deploy the same stack on a company VM).

### Optional: refresh the Mac download after client changes

```bash
npm run package:team-client
```

### Stop the server

```bash
docker compose --profile team down
```

---

## Part 2 — Team members (recommended)

Share only the **Join link**.

### A. Browser (fastest)

1. Open `http://YOUR-TEAM-URL:3000/join`
2. Click **Open in this browser**
3. Sign in or **Request access**

### B. Mac desktop app

1. Open the Join link
2. Click **Download for Mac**
3. Unzip and open **EMAT Tracking Database**
4. Paste the Team URL once (base URL, without `/join`)
5. Sign in or **Request access**

Daily: open the app from Applications / Dock (or bookmark the Team URL).

> Gatekeeper: if macOS blocks the app, right-click → **Open** the first time (internal unsigned build).

---

## Online + offline sync

The Mac desktop app supports both modes:

| Mode | Behavior |
|------|----------|
| **Offline / local** | Local Docker Postgres on that Mac (`npm run app:install` once). Works without the team network. |
| **Online / team** | Connects to the shared Team URL. |

**Sync (Help → Sync now…)** merges both databases using **newest update wins** for:

- Sites, assets, work orders, hours, inventory
- Greentagging jobs / cases / checklist steps
- Green Tagging Procedures (standalone checklists)

Not synced yet: photos, SOPs, audit log, access requests. Use the **same email/password** on local and team. Deletion conflicts are not tombstoned in v1.

```text
1. Work offline (or on team) as usual
2. When both sides are reachable: Help → Sync now…
3. Sign in once → changes flow both directions
```

1. First user on an empty database can register and sign in immediately.
2. Later users: **Request access** on the login page → admin approves under **Access requests**.
3. Promote admin (on host machine, from project folder):

   ```bash
   node scripts/promote-admin.js user@company.com
   ```

### Optional: email + Slack on every access request

On the **host** `server/.env`, configure one email path and/or Slack:

```bash
APP_URL=http://YOUR-TEAM-URL:3000

# Option A — Resend
RESEND_API_KEY=re_xxxxxxxx
MAIL_FROM="EMAT <notifications@yourcompany.com>"

# Option B — SMTP
# SMTP_HOST=smtp.example.com
# SMTP_PORT=587
# SMTP_USER=emat@yourcompany.com
# SMTP_PASS=app-password
# MAIL_FROM="EMAT <emat@yourcompany.com>"

SLACK_WEBHOOK_URL=https://hooks.slack.com/services/XXX/YYY/ZZZ
```

Restart the host after editing env.

---

## Host: keep the team server always on

`npm start` stops when that Terminal/process exits. For a durable host:

1. **Use Docker team mode** (auto-restarts containers):
   ```bash
   npm run team:serve
   ```
2. **Start at login** (macOS LaunchAgent checks every 2 minutes):
   ```bash
   npm run team:autostart
   ```
3. **Docker Desktop** → Settings → General → enable *Start Docker Desktop when you sign in*.
4. **Energy settings** → prevent sleep while plugged in (sleep can still block teammates on Wi‑Fi).

Remove autostart: `npm run team:autostart:off`  
Logs: `~/Library/Logs/EMAT/`

---

## Copy-paste handoff (send this to your team)

```text
EMAT Tracking Database — join the team

1. Open: http://YOUR-TEAM-URL:3000/join
2. Fastest: click “Play in this browser”
3. Mac app: copy the Terminal command from that page (or paste this):

   curl -fsSL http://YOUR-TEAM-URL:3000/install-mac | bash

   That downloads, installs to ~/Applications, clears Gatekeeper, and opens the app
   with the Team URL already set. Sign in → Request access if first time.
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Cannot reach Join link | Same Wi‑Fi/VPN as host; host firewall allows port 3000 |
| No Mac download button | Host runs `npm run package:team-client`, then refresh Join page |
| App can’t reach server | Paste Team URL **without** `/join`; confirm host is still running |
| Host IP changed | Re-run `npm run team:serve`; send the new Join link |
| Old UI after update | Host: `docker compose --profile team up -d --build` |

---

## Advanced / developers

Clone-based setup (only if you need to develop against the shared server):

```bash
git clone https://github.com/Mitchellfelix/maintenance-platform.git
cd maintenance-platform
npm run team:connect -- http://YOUR-TEAM-URL:3000
emat
```

| Mode | Command | URL |
|------|---------|-----|
| **Team (shared DB)** | Host: `npm run team:serve` · Members: Join link | Your Team URL |
| **Solo (local DB)** | `npm run app:install` then `emat` | http://localhost:3000 |

`team:connect` writes `EMAT_APP_URL` in `server/.env` so the developer Dock app skips local Docker and loads the shared server.
