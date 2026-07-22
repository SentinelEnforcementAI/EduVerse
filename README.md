# Sentinel Watch

Safeguarding intelligence for UK schools and Multi-Academy Trusts. Sentinel
Watch ingests school data via Wonde, runs a hybrid risk engine (deterministic
rules first, LLM second), and surfaces signals to Designated Safeguarding
Leads. The system flags — humans decide.

Read [CLAUDE.md](./CLAUDE.md) for the principles, stack, and build order.

## What's in the repository

```
apps/web       — the web app (Next.js App Router, tRPC, Tailwind, shadcn/ui)
packages/db    — database schema and client (Prisma → PostgreSQL)
packages/sync  — Wonde ingestion: API client, sync jobs, Redis queue worker
packages/rules — the risk engine: versioned rules, execution log, signals
docker-compose.yml — local Postgres + Redis
```

## Running it locally

These steps assume nothing beyond a Mac or Windows/Linux machine and a
terminal. Each step says what it does and how you know it worked.

### 1. Install the tools (one-off)

You need three things installed:

1. **Docker Desktop** — runs the database locally.
   Download from <https://www.docker.com/products/docker-desktop/>, install,
   and open it once so it's running (whale icon in your menu bar).
2. **Node.js 22** — runs the app.
   Download the "LTS" installer from <https://nodejs.org>.
   Check it worked: open a terminal and run `node --version` — you should see
   `v22` or higher.
3. **pnpm** — installs the project's dependencies.
   In a terminal run: `npm install -g pnpm`
   Check: `pnpm --version` prints a number.

### 2. Get the code and configure it

```bash
git clone <this repository URL>
cd EduVerse
cp .env.example .env
```

The `.env` file holds local configuration. The defaults work as-is for local
development — you don't need to edit anything yet. Never commit `.env`.

### 3. Start the database

With Docker Desktop running:

```bash
docker compose up -d
```

This starts Postgres and Redis in the background. Check it worked:
`docker compose ps` shows both services as "healthy" (give it ~10 seconds).

### 4. Install dependencies and set up the database

```bash
pnpm install
pnpm db:migrate
```

`pnpm db:migrate` creates the database tables. It will ask for a migration
name only if the schema has changed since the last migration — otherwise it
just applies what's there.

Then load the synthetic dataset (two schools, ~800 pupils each, 12 months of
attendance, behaviour, and attainment):

```bash
pnpm db:seed
```

This takes a minute or two. It's safe to re-run — it wipes and regenerates
the synthetic data each time. Every pupil is invented; the dataset includes
deliberately embedded risk patterns so the risk engine has something real to
find. The seed prints a summary, and writes which pupils carry which pattern
to `packages/db/prisma/seed-manifest.json` (not committed).

### 5. Run the app

```bash
pnpm dev
```

Open <http://localhost:3000>. You should see the Sentinel Watch landing page.

**Signing in locally:** click "Sign in" and use one of the seeded DSL
accounts — `dsl@downlands.example` or `dsl@patcham.example`. No real email is
sent in development — instead, the sign-in link is printed in the terminal
where `pnpm dev` is running. Look for a block that says "magic link", copy
the link into your browser, and you'll land on that school's dashboard.

**Sign-in is invite-only.** An email address that hasn't been provisioned
gets no link and no account — the form looks the same either way, on
purpose, so the sign-in page can't be used to discover which addresses
exist. To provision a DSL:

```bash
pnpm --filter @sentinel/db user:add \
  --email dsl@school.org.uk --tenant downlands --name "A. Example"
```

Every provisioning action is written to that school's audit trail.

**Real email (production):** set `EMAIL_TRANSPORT=ses` and `EMAIL_FROM` in
the environment. Sign-in links are then sent via AWS SES in eu-west-2 (the
region is hardcoded — email dispatch stays inside UK infrastructure).

### Something not working?

- **`docker compose up` fails** — is Docker Desktop actually open?
- **`pnpm db:migrate` can't connect** — the database isn't up yet; run
  `docker compose ps` and wait for "healthy".
- **Port 3000 or 5432 already in use** — something else on your machine is
  using it; quit that app or ask for help changing the port.
- **Database errors after pulling new changes** — the database setup may have
  changed. Reset it with `docker compose down -v` (deletes local dev data,
  which is only ever synthetic) then `docker compose up -d` and
  `pnpm db:migrate`.

## Syncing from Wonde (sandbox)

Sentinel Watch reads school data through [Wonde](https://wonde.com). To try
it against Wonde's sandbox:

1. Register at <https://wonde.com/developers> — you get a test school and an
   API key.
2. Put the key and the test school's id in `.env` (`WONDE_API_KEY`,
   `WONDE_SCHOOL_ID`). Never commit them.
3. Start the sync worker in one terminal: `pnpm worker`
4. Enqueue a full sync in another: `pnpm sync --tenant downlands --type all`

The dashboard's "Data sync" card shows each job's outcome. Syncs are
idempotent — running them again is always safe. Sentinel Watch only ever
reads from Wonde; it never writes back to the school's MIS.

The real Downlands and Patcham connections happen only after signed DPAs.

## Running the risk engine

With the synthetic data seeded:

```bash
pnpm rules --tenant downlands
```

This evaluates every rule against the school's data and raises signals for
the DSL to review — you'll see the count on the dashboard. Every signal
carries its full reasoning: which rule fired, the computed numbers against
their thresholds, and the underlying records. Signals are never actioned
automatically: on each signal the DSL confirms, escalates, or dismisses
(dismissal requires a note). Every decision is applied atomically, recorded
in an append-only decision log alongside an audit entry, and can never be
edited or deleted afterwards — by anyone.

Rules are versioned: the exact definition that produced each signal is
stored, and the engine refuses to run if a rule's parameters change without
a version bump. Re-running the engine is always safe — open signals are
refreshed, not duplicated, and signals a DSL has already actioned are never
touched.

## AI summaries (advisory only)

On a signal a DSL has confirmed, Sentinel Watch can generate a short
AI-written summary of the pattern — via Claude on AWS Bedrock in the London
region (hardcoded; UK data residency is structural). Before anything is sent,
the data is pseudonymised: no names, no UPNs, no free-text notes — only the
computed numbers behind the signal, and a fail-closed check blocks the call
if an identifying value slips through. Summaries are labelled AI-generated in
the database and on screen, are permanent once written, and are strictly
advisory: nothing in the system reads them to make a decision. Every call is
logged to the audit trail with the exact prompt version and model used.

To enable it locally, put AWS credentials in `.env` (see `.env.example`).
Everything else works without them.

## Checks (what CI runs)

```bash
pnpm lint        # code style and correctness rules
pnpm typecheck   # TypeScript, strict
pnpm test        # unit tests + row-level security isolation tests
```

The row-level security tests run against the real local database, so
`pnpm test` needs Docker Compose up (step 3 above) and a `.env` file. This is
deliberate: tenant isolation lives in Postgres policies, and the tests prove
those policies hold — a school can never see another school's data.

GitHub Actions runs all three on every pull request and push to `main`,
with a throwaway Postgres for the isolation tests.

## Useful commands

```bash
pnpm dev         # run the app in development
pnpm db:studio   # browse the database in a web UI
pnpm db:migrate  # apply schema changes locally
docker compose down   # stop Postgres + Redis (data is kept)
```

## Where this is going

The build proceeds in vertical slices (see the build order in
[CLAUDE.md](./CLAUDE.md)). This scaffold is step 1: monorepo, app shell,
database, auth via email magic links, and CI. Step 2 adds tenancy and
row-level security; synthetic data, Wonde ingestion, and the risk engine
follow.

Development uses synthetic pupil data only. No real pupil data enters this
system until DPAs are signed and the platform is deployed to UK
infrastructure (AWS eu-west-2).
