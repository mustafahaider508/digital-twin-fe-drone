# Dashboard in Node-RED

## What we did

We made the Digital Twin Dashboard show at **http://localhost:1880/drone-map** inside Node-RED using the **uibuilder** package.

## How it works

1. **Build** — A script (`build-uibuilder.sh`) builds the Next.js app as static files and puts them in the `out/` folder. We use a flag `NEXT_PUBLIC_UIBUILDER_ENTRY=dashboard` so the **root page** shows the dashboard instead of the Twin Registry.

2. **Root page** — In `src/app/page.js` we check that flag. If it is set, we render the DroneDashboard component. Otherwise we render the normal Twin Registry.

3. **Layout** — In `src/app/ConditionalLayout.jsx` we use the same flag so that when the dashboard is at the root, the page is full-screen (no header/footer).

4. **Deploy** — Copy the contents of `out/` into Node-RED’s uibuilder folder, e.g. `~/.node-red/uibuilder/drone-map/src/`. Then open http://localhost:1880/drone-map to see the dashboard.

## Commands

- **Build:** `npm run build:uibuilder`
- **Build and copy to Node-RED (same machine):** `npm run deploy:uibuilder`
- **Copy manually:** `cp -r out/* ~/.node-red/uibuilder/drone-map/src/`

---

## Deploy to remote Node-RED (e.g. http://smartiotcloud.io:40317/)

You need **SSH access** to the server that runs Node-RED.

1. **Build locally**
   ```bash
   npm run build:uibuilder
   ```

2. **Upload `out/` to the server** using one of these.

   **Option A – SCP** (replace with your SSH user and path):
   ```bash
   scp -r out/* USER@smartiotcloud.io:PATH_TO_UIBUILDER_SRC/
   ```
   Example if uibuilder is in the default location for user `ubuntu`:
   ```bash
   scp -r out/* ubuntu@smartiotcloud.io:~/.node-red/uibuilder/drone-map/src/
   ```

   **Option B – RSYNC** (good for repeated deploys):
   ```bash
   rsync -avz --delete out/ USER@smartiotcloud.io:PATH_TO_UIBUILDER_SRC/
   ```
   Example:
   ```bash
   rsync -avz --delete out/ ubuntu@smartiotcloud.io:~/.node-red/uibuilder/drone-map/src/
   ```

3. **Open the dashboard** at:  
   **http://smartiotcloud.io:40317/drone-map**

**Notes:**

- `USER` = your SSH login (e.g. `root`, `ubuntu`, or your username).
- `PATH_TO_UIBUILDER_SRC` = folder where uibuilder serves files for this app. Often `~/.node-red/uibuilder/drone-map/src/` — the instance name (`drone-map`) must match the one in Node-RED.
- If SSH uses a different port (e.g. 22): `scp -P 22 -r out/* USER@smartiotcloud.io:...` or `rsync -e "ssh -p 22" ...`
- If you don’t know the path on the server, SSH in and look for `.node-red/uibuilder/` in your home directory.

---

## Quick commands for smartiotcloud.io

Replace `USER` with your SSH username (e.g. `ubuntu`, `root`).

```bash
# Build
npm run build:uibuilder

# Upload
rsync -avz --delete out/ USER@smartiotcloud.io:~/.node-red/uibuilder/drone-map/src/
```

One line (build + upload):

```bash
npm run build:uibuilder && rsync -avz --delete out/ USER@smartiotcloud.io:~/.node-red/uibuilder/drone-map/src/
```

Dashboard URL: **http://smartiotcloud.io:40317/drone-map**
