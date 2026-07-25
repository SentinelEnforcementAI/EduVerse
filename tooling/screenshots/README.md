# Platform tour — screenshot pipeline

Regenerates the visual tour in [`docs/demo/tour/`](../../docs/demo/tour/): a
screenshot of every screen, captured from the running app against the seeded
demo trust, plus a gallery page that presents them with the feature rundown.

Everything here runs against a **local** instance with **synthetic** data only.
The context step is hard-guarded to refuse unless `APP_URL` is a local host.

## Prerequisites

- Postgres and Redis running, `.env` pointing at them (`APP_URL=http://localhost:3000`).
- Playwright's Chromium available. It's a dev dependency; in a sandbox where the
  browser lives elsewhere, set `PW_CHROMIUM` to the chrome binary.

## Run

```bash
# 1. schema + demo data (5 schools, ~1,100 synthetic pupils, 12 months)
pnpm db:deploy
DEMO_PUPILS=220 DEMO_MONTHS=12 pnpm db:seed:demo

# 2. a production build of the app, served locally
pnpm build
pnpm --filter web start &      # http://localhost:3000

# 3. seed the demo context, capture every screen, build the gallery
pnpm demo:tour
```

`pnpm demo:tour` runs three steps:

1. **`scripts/demo-tour-context.ts`** (in `@sentinel/db`) — seeds a synthetic
   inbound-mail exchange (so the intake queue and the case comms timeline are
   demonstrative), mints a session cookie for each demo role, resolves the
   dynamic ids the capture visits, and writes them to
   `tooling/screenshots/.context.json` (git-ignored — it holds session tokens).
2. **`capture.mjs`** — signs in as each role and writes
   `docs/demo/tour/screens/NN-name.jpg` for every screen.
3. **`build-gallery.mjs`** — regenerates `docs/demo/tour/gallery.html`, a thin
   page whose `<img>`s reference `screens/*.jpg` (small, viewable on GitHub).

Commit the refreshed `screens/*.jpg` and `gallery.html`.

## A self-contained gallery to share

```bash
pnpm demo:tour:embed
```

writes `docs/demo/tour/platform-gallery.embedded.html` with every image inlined
as a data URI — one portable file to host or hand to someone. It's git-ignored;
regenerate it when you need it.

## Adding or renaming screens

Edit the `SHOTS` list in `capture.mjs` (what gets captured) and the matching
`sections` copy in `build-gallery.mjs` (how it's presented and described). Keep
the two in step.
