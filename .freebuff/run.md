# FamOS dev preview

This thread runs the Vite dev server from `/Users/alexvorobiev/Project Vibe/FamOS/famOS`
(the same path is the main checkout and this thread's workspace).

The preview is a plain Vite single-page app. `npm run dev` boots Vite which serves
`index.html` plus the lazy `pages/*.jsx` route bundles. There is no separate API
server; the app talks directly to Supabase via publishable URL + anon key from
`VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env.local`, and to
optional Google Maps / Weather / SerpApi / DoorDash edge functions deployed at
https://api-fam-os.app/.

## Reproduce artifacts

A fresh checkout needs the following to come up cleanly:

1. `node_modules/` — install with the project's package manager:
   - `npm install` (preferred — no `pnpm-lock.yaml` or `yarn.lock` present; lockfile is `package-lock.json`).
2. `.env.local` — copy from the main checkout; never symlink, because the port
   may need adapting per worktree:
   - `cp /Users/alexvorobiev/Project Vibe/FamOS/famOS/.env.local "$WORKTREE/.env.local"`
   - If the port in the file differs from the chosen preview port, leave it —
     `VITE_*` envs are read at build time and we use defaults during dev.
3. `.env.example` — committed as the deployment checklist.

This worktree already has `node_modules/` present and `.env.local` available
locally, so `npm install` and `cp` are normally no-ops. Run them only if `lsof`
shows port 5173 is in use or if `.env.local` is missing.

## Run the server

Default Vite port is `5173`. Pick it if free (`lsof -nP -i :5173`); otherwise
the next free port (5174, 5175, …). Run from the worktree:

```
cd /Users/alexvorobiev/Project Vibe/FamOS/famOS
( nohup npm run dev -- --host 127.0.0.1 --port 5173 strictPort \ \
    > /Users/alexvorobiev/Project Vibe/FamOS/famOS/.freebuff/preview-thmrvfzhw0gbyl.log 2>&1 & echo $! )
```

Then poll the URL until it answers:

```
curl -fsS http://127.0.0.1:5173 | head -10
```

When the URL responds with HTML, call `register_preview` (URL + the pid printed
by `echo $!`). Use the `preview_snapshot`, `preview_screenshot`, and
`preview_logs` tools to confirm the page actually rendered (no console errors,
no failed module loads). If `/` returns a redirect to `/auth` or `/today`,
that's still success — the SPA shell rendered.

To stop preview: `kill <pid>` (or `kill $(cat .freebuff/preview-pid)` if we
wrote that helper file).
