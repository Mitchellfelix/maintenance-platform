# EMAT — Team setup with one shared URL

Use this when everyone should hit **the same server and database**, not separate localhost copies.

| Role | What they do | Result |
|------|----------------|--------|
| **Host (you)** | `npm run team:serve` | App on port 3000, reachable on your network |
| **Team member** | `npm run team:connect -- <team-url>` then `emat` | Desktop app opens the shared URL |

---

## Part 1 — Host: run the shared server (once)

**Requirements:** Docker Desktop, this repo on the host machine.

```bash
cd ~/maintenance-platform
cp server/.env.example server/.env   # if you have not already
# Edit server/.env and set a strong JWT_SECRET

npm run team:serve
```

The script prints a **Team URL** like `http://192.168.1.50:3000`. That is the address you send to everyone.

**Keep the host machine running** (or deploy to a cloud VM / internal server the same way). Team members only connect to that URL — they do not need local Postgres.

### Optional: custom hostname

If you use DNS (e.g. `http://emat.yourteam.local`), point it at the host and share that URL instead. HTTPS requires a reverse proxy (nginx, Caddy, etc.) in front of port 3000.

### Stop the server

```bash
docker compose --profile team down
```

---

## Part 2 — Team member: connect and launch

**Requirements:** Node.js 20+, Mac (for Dock app). **No Docker required** on member machines.

```bash
git clone <REPO-URL> ~/maintenance-platform
cd ~/maintenance-platform
npm run team:connect -- http://YOUR-TEAM-URL:3000
```

Replace `http://YOUR-TEAM-URL:3000` with the URL the host gave you.

Then open a **new terminal tab** and:

```bash
emat
```

Or open **Applications → EMAT Tracking Database** from the Dock.

### Browser-only option

Team members can skip the desktop install and open the **Team URL** in Chrome/Safari. Same app, same data.

---

## Part 3 — Accounts

1. First user on an empty database can register and sign in immediately.
2. Later users: **Request access** on the login page → admin approves under **Access requests**.
3. Promote admin (on host machine, from project folder):

   ```bash
   node scripts/promote-admin.js user@company.com
   ```

### Optional: email + Slack on every access request

On the **host** `server/.env`, configure one email path and/or Slack:

```bash
# Review link in messages
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

# Slack Incoming Webhook
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/XXX/YYY/ZZZ
```

Restart the host after editing env. Notifications (email still succeeds for the underlying action if mail fails):

- New signup/elevation requests → email all **ACTIVE Admin + Ops Lead** users and/or Slack
- Access request **approved** → email the requester that they can sign in
- Admin **creates a user** (with credentials email on) → welcome email with temporary password
- Invite accepted → confirmation email that the account is ready
- **Forgot password** → one-time reset link (30 minutes; Sign in → Forgot password?)

Admins and Ops Leads can approve under **Access requests** (Ops Leads cannot assign the Admin role). Without email configured, use `node scripts/reset-password.js user@company.com "new-password"` on the host.

---

## Copy-paste handoff (send this to your team)

Replace `http://YOUR-TEAM-URL:3000` with your real Team URL from `npm run team:serve`.

```text
EMAT Tracking Database — team setup

Team URL: http://YOUR-TEAM-URL:3000

Browser (quickest):
  Open the Team URL above.

Desktop app (Mac):
  1. Install Node 20+
  2. git clone <REPO-URL> && cd maintenance-platform
  3. npm run team:connect -- http://YOUR-TEAM-URL:3000
  4. New terminal tab → emat

First time: Request access on login → wait for admin approval.

Daily: emat  (or open the Team URL in your browser)
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Cannot reach Team URL | Same Wi‑Fi/VPN as host; host firewall allows port 3000 |
| `team:connect` works but `emat` fails | New terminal tab; or `export PATH="$HOME/.local/bin:$PATH"` |
| Host IP changed | Re-run `npm run team:serve` for new IP; members re-run `team:connect` with new URL |
| Old UI after update | Host: `docker compose --profile team up -d --build` |

---

## Local-only vs team mode

| Mode | Command | URL |
|------|---------|-----|
| **Solo (local DB)** | `npm run app:install` then `emat` | http://localhost:3000 |
| **Team (shared DB)** | Host: `npm run team:serve` · Member: `npm run team:connect -- <url>` | Your Team URL |

`team:connect` writes `EMAT_APP_URL` in `server/.env` so the desktop app skips local Docker and loads the shared server.
