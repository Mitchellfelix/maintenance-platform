# EMAT Tracking Database — Desktop handoff guide (draft)

How to share this project so someone else can run it and open the app from their Mac — without typing project paths every time.

---

## Quick summary

| Approach | Best for | Each person needs |
|----------|----------|-------------------|
| **A. Full local copy** | Solo use or separate databases | Node, Docker, one-time `npm run app:install` |
| **B. Shared server** | Team with one database | Node, `app:install`, `EMAT_APP_URL` in `server/.env` |

After **one-time install**, users launch with **`emat`** from any terminal, or from **/Applications** / the Dock. No need to `cd` into the project folder.

The `.app` is not a fully standalone installer — it still uses the project folder on disk for Node, Electron, and the API. Install registers that folder path in `~/.emat/home`.

---

## Recommended setup (one time per machine)

From the project folder (only needed once):

```bash
cd ~/maintenance-platform   # or wherever they cloned/unzipped
docker compose up -d
cp server/.env.example server/.env
npm run app:install
```

`app:install` does all of this:

- Runs `npm install` (Node deps + Electron)
- Saves the project path to `~/.emat/home`
- Adds a global **`emat`** command to `~/.local/bin`
- Installs **`/Applications/EMAT Tracking Database.app`**
- Updates `~/.zshrc` / `~/.bashrc` to put `~/.local/bin` on `PATH` (if needed)

Then:

1. Open a **new terminal tab** (or run `export PATH="$HOME/.local/bin:$PATH"`)
2. Type **`emat`** from any directory, or
3. Drag **EMAT Tracking Database** from `/Applications` to the Dock

---

## Launch from anywhere (daily use)

| Method | Command / action |
|--------|------------------|
| **Terminal** | `emat` |
| **Stop server** | `emat stop` |
| **Force rebuild** | `emat build` |
| **Dock / Finder** | Open `/Applications/EMAT Tracking Database.app` |
| **Re-run install** | `emat install` (if Dock app or PATH breaks) |

You do **not** need:

```bash
cd ~/maintenance-platform
npm run app:launch
```

Those still work from the project folder, but **`emat`** is the intended daily launcher.

---

## Always up to date on launch

Each time the app starts (via `emat` or the Dock icon), the launcher automatically:

1. **Rebuilds the UI** if client source (`client/src`, etc.) is newer than `server/public/`
2. **Restarts the API** if server code or Prisma schema changed
3. **Runs DB migrations** (`npm run db:deploy`)
4. Starts Docker Postgres if using local mode (Docker must be running)

So after pulling new code from git, users can just run **`emat`** again — no manual `npm run build` unless they want to force it (`emat build`).

---

## What to send

### Option 1: Git (recommended)

Push to GitHub/GitLab and share the repo link.

### Option 2: Zip archive

Zip the project but **exclude**:

- `node_modules/`
- `server/.env` (secrets — never share)
- `apps/` (optional local copy; install uses `/Applications`)
- `.emat-app.pid`, `.emat-app.log`

Include `server/.env.example`. Recipient copies it to `server/.env`.

---

## Recipient requirements (Mac)

| Requirement | Purpose |
|-------------|---------|
| **Node.js 20+** | API + Electron desktop shell |
| **Docker Desktop** | Local PostgreSQL (Option A only) |
| **npm** | Installed with Node |

Windows/Linux: desktop scripts are macOS-oriented today (`.app`, Dock, `osascript`).

---

## Setup — Option A: Each person runs locally

```bash
git clone <repo-url> ~/maintenance-platform
cd ~/maintenance-platform
docker compose up -d
cp server/.env.example server/.env
npm run app:install
```

Open a new terminal, then:

```bash
emat
```

**First launch** may take a minute (UI build + DB migrations). Docker Desktop must be running.

### Legacy / project-folder commands

Still available if needed:

| Command | What it does |
|---------|----------------|
| `npm run app:install` | Same as first-time setup above |
| `npm run app:launch` | Open desktop window (from project folder only) |
| `npm run app:stop` | Stop background server |
| `npm run app:create` | Create a copy under `apps/` only (not required if using `/Applications`) |

---

## Setup — Option B: Shared server (team)

Deploy the app + Postgres once on an internal host. Each desktop only opens that URL.

1. Deploy with `npm run build && npm start` (or Docker) on the shared server.
2. On each Mac, in `server/.env`:

   ```
   EMAT_APP_URL=https://emat.yourcompany.internal
   ```

3. Run `npm run app:install`, then launch with **`emat`** or the Dock app.

No local Docker required. Everyone sees the same data.

---

## Accounts and admin

- **First registered user** on an empty database becomes active immediately (bootstrap admin path).
- **Later users** use **Request access** on the login page and need admin approval before sign-in.
- Promote a user to admin (from project folder):

  ```bash
  node scripts/promote-admin.js user@company.com
  ```

- Reset a forgotten password:

  ```bash
  node scripts/reset-password.js user@company.com "NewPassword123"
  ```

Sign out and back in after role or password changes (JWT is not auto-refreshed).

---

## Nav tabs in the desktop app

The Dock app serves the **production build** from `server/public/`, not the Vite dev server (`npm run dev` on port 5173).

| Tab | Visibility |
|-----|------------|
| Dashboard, Sites, Assets, Work Orders, Inventory | Always |
| Request access | Signed in |
| User access, Access requests, Audit log | Admin only |

If tabs are missing after an update, run **`emat`** again (auto-rebuild) or **`emat build`**.

---

## npm scripts reference

| Command | What it does |
|---------|----------------|
| `npm run dev` | Dev mode: UI on :5173, API on :3000 |
| `npm run build` | Build UI into `server/public/` |
| `npm start` | Production API + static UI on :3000 |
| `npm run app:install` | **One-time:** global `emat` command + `/Applications` app |
| `npm run app:launch` | Open desktop window (project folder only) |
| `npm run app:stop` | Stop background API server |
| `npm run app:create` | Create `apps/EMAT Tracking Database.app` (optional) |

## Global CLI reference

| Command | What it does |
|---------|----------------|
| `emat` | Open desktop app (default) |
| `emat stop` | Stop background server |
| `emat build` | Force rebuild UI + Prisma client |
| `emat install` | Re-run install (PATH, Dock app, `~/.emat/home`) |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `Missing script: app:launch` | You are in `~`, not the project. Use **`emat`** instead, or run `npm run app:install` once from the project folder |
| `command not found: emat` | New terminal tab, or `export PATH="$HOME/.local/bin:$PATH"`, or re-run `npm run app:install` |
| Dock app says “run app:install” | Run `npm run app:install` once from the project folder |
| Invalid credentials | Wrong password — `node scripts/reset-password.js email@company.com "password"` |
| Pending approval message | Admin must approve under **Access requests** |
| Old UI / missing tabs | Run **`emat`** again or **`emat build`** |
| Port 3000 in use | `emat stop` or quit other servers on :3000 |
| Docker errors | Start Docker Desktop, then `docker compose up -d` |
| Moved project folder | Run `npm run app:install` again from the new location |

---

## Copy-paste handoff note

Send this block to a new user:

```text
EMAT Tracking Database — Mac setup

1. Install Node 20+ and Docker Desktop
2. Clone/unzip project → cd into folder
3. docker compose up -d
4. cp server/.env.example server/.env
5. npm run app:install
6. Open a new terminal tab
7. Type: emat
   (or open /Applications/EMAT Tracking Database.app from the Dock)

Daily use:  emat
Stop server: emat stop
Rebuild UI:  emat build

Reset password (from project folder):
  node scripts/reset-password.js email@company.com "password"
```

---

## How install tracks the project

| File / path | Purpose |
|-------------|---------|
| `~/.emat/home` | Absolute path to the project (used by Dock app + `emat` CLI) |
| `~/.local/bin/emat` | Symlink to `scripts/emat` |
| `/Applications/EMAT Tracking Database.app` | Dock / Finder launcher |
| `EMAT_HOME` env var | Optional override for project path |

If the repo is moved, run **`npm run app:install`** again from the new location.

---

## Future: Windows / notarized DMG

Mac zip + Join page is the team client for v1. Windows installers and Apple notarization can follow; teammates who can’t use the Mac zip should use the browser button on `/join`.
