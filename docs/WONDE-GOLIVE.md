# Go live with Wonde (sandbox first)

How to connect a Wonde school so it flows into Sentinel Watch as a live,
engine-analysed school. Start with the **sandbox** (dummy data) for demos and
integration testing; the same steps apply to a real school once a DPA is signed.

Ingestion is **read-from-source only** — Sentinel Watch never writes back to the
MIS (overlay principle). Every record carries a Wonde-derived idempotency key,
so syncs converge instead of duplicating.

## What "connected" gives you

The sandbox school appears inside the demo trust (Weald Learning Trust) as a
real school: its roll, attendance, behaviour and attainment are pulled from
Wonde, and the rules engine runs over them. It sits **alongside** the synthetic
schools, so the demo shows both a genuinely-connected MIS *and* the full
trust-wide / cross-school picture the synthetic data carries.

> The sandbox is generic MIS dummy data: it will not contain engineered
> safeguarding patterns or the hero disclosure case. For a story-driven demo,
> keep using the synthetic schools for the narrative and use the connected
> sandbox to prove the live pipeline.

## One-time setup

1. **Store the key.** Put the sandbox API key in Secrets Manager as
   `sentinel-watch/wonde-api-key` (the Bootstrap workflow already created the
   secret with a placeholder). Update it with the real value:

   ```
   aws secretsmanager put-secret-value \
     --secret-id sentinel-watch/wonde-api-key \
     --secret-string 'THE_SANDBOX_KEY' --region eu-west-2
   ```

   Then force a new worker release so the running task picks it up (Deploy
   workflow, or `aws ecs update-service --cluster sentinel-watch --service worker --force-new-deployment`).

2. **Find the sandbox school id.** The token can reach every school that has
   approved the app. List them (the `GET /v1.0/schools` endpoint), e.g.:

   ```
   curl -s https://api.wonde.com/v1.0/schools \
     -H "Authorization: Bearer THE_SANDBOX_KEY" | jq '.data[] | {id, name}'
   ```

## Connect the sandbox (one click)

Actions tab → **Connect Wonde sandbox** → Run workflow, providing:

- **wonde_school_id** — the sandbox school id from step 2 (required)
- **school_name** — display name (default "Wonde Sandbox School")
- **school_slug** — URL slug (default "wonde-sandbox")

It links a tenant in the trust, pulls students → attendance → behaviour →
attainment, and runs the rules engine. ~2–4 min. Sign in as the director to see
the new school in the MAT view (a DSL account `dsl@<slug>.example` is created
too).

The same thing from a shell (for the first guided run):

```
WONDE_API_KEY=... pnpm --filter @sentinel/sync sync:sandbox \
  --school-id <id> --name "Wonde Sandbox" --slug wonde-sandbox
```

## Invalid includes self-heal

Wonde validates the `include` list per endpoint and returns
`400 invalid_include` for the whole request if any expansion is unknown for that
school's MIS (the sandbox, for example, does not expose `registration_group` on
students). The client tolerates this: on `invalid_include` it drops the named
expansion and retries, logging `[wonde] …: dropping unsupported include "x"`, so
the sync degrades to fewer fields instead of failing the connect. A dropped
`registration_group` falls back to a readable `Yr N` label on the pupil.

## First-run verification

The client and mappers follow Wonde's published v1.0 structure, but the exact
field nesting on `include`d objects should be confirmed against real payloads.
On the first sandbox pull, check the reported counts:

- **skipped high on students** → check `year.data.code`/`registration_group.data.name`
  nesting in `packages/sync/src/wonde/types.ts` and `yearGroupFrom`.
- **skipped high on attendance/behaviour/attainment** → the pupil link resolves
  by `wonde_id`; confirm the `student.data.id` nesting and the
  `attendance_code` / `points` / result `value` shapes.

Any correction lives in the job mapping functions
(`packages/sync/src/jobs/sync-jobs.ts`) — callers do not change.

## Ongoing sync

For the MVP, re-running the connect workflow refreshes the school (idempotent).
For continuous sync, the nightly job path (`@sentinel/sync` worker + queue) runs
per linked tenant. **Enhancement for scale:** pass Wonde's `updated_after` URL
parameter so the nightly job pulls only what changed rather than the full set —
add it to the `WondeClient` methods and thread the last-synced watermark from
`sync_runs`.

## Real schools (post-DPA)

Identical flow, but connect the real school id and switch off any synthetic
overlay for that tenant. Real pupil data stays in AWS London (eu-west-2); no
pupil data leaves UK infrastructure (CLAUDE.md principle 2).
