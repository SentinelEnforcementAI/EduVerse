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

### 5. Run the app

```bash
pnpm dev
```

Open <http://localhost:3000>. You should see the Sentinel Watch landing page.

**Signing in locally:** click "Sign in", enter any email address, and press
the button. No real email is sent in development — instead, the sign-in link
is printed in the terminal where `pnpm dev` is running. Look for a block that
says "magic link", copy the link into your browser, and you'll land on the
dashboard.

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
