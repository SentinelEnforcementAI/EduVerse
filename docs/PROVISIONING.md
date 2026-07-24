# Provisioning a customer (silo per MAT)

How a new Multi-Academy Trust goes from "signed" to "signed in" — the
flick-of-a-switch that commercialisation slice 2 delivers. Read this alongside
`infra/README.md` (the underlying AWS stack) and `docs/COMMERCIALISATION.md`
(why silo, and the deployment model).

Everything stays in AWS London (eu-west-2). UK data residency is structural —
the region is hardcoded in the Terraform provider and the application code, not
a variable.

## The model: one isolated stack per customer

Each MAT gets its own stack — its own VPC, RDS database, Redis, ECS services,
secrets and ECR repositories. There is no shared database and no cross-customer
row: "one MAT's data can never physically touch another's" is enforced by
separate infrastructure, not only by row-level security.

Isolation is by the Terraform `project` name-prefix variable. Every resource is
named `<project>-*`, so:

- the demo / first stack uses `project = sentinel-watch` (the **Bootstrap AWS**
  workflow), and
- a customer uses `project = sentinel-<slug>` (the **Provision customer**
  workflow),

with a **separate remote-state key per customer** (`customers/<slug>.tfstate`).
Same AWS account, hard-separated stacks. (Going further — a separate AWS account
per MAT via Organizations — is the open CTO-DECISION below; the application and
data layer are identical either way.)

## Two halves: infrastructure, then data

Provisioning has an infrastructure half and a data half. The **Provision
customer** workflow (`.github/workflows/provision-customer.yml`) runs both, in
the proven order the Bootstrap workflow established:

1. **Infrastructure** — Terraform `apply` with `-var project=sentinel-<slug>`
   into the customer's own state key: VPC, RDS, Redis, ECS, ALB, secrets, ECR.
2. **Release** — build and push the web + worker images to the customer's ECR,
   run migrations, create the non-superuser app role.
3. **Data** — `customer:provision:prod` creates the customer's trust, any named
   schools, and the first trust administrator. This step is idempotent and is
   the only part that is unit-tested (`packages/db/tests/provisioning.test.ts`),
   because it needs no AWS.
4. **Go live** — re-apply with the real `app_url` (the customer subdomain, or
   the raw ALB URL until DNS is set up) and roll both services.

### Running it

From the Actions tab → **Provision customer** → Run workflow:

| Input | Example | Notes |
|-------|---------|-------|
| `customer_name` | `Weald Learning Trust` | The MAT's display name. |
| `customer_slug` | `weald` | Lowercase DNS label. Becomes the stack prefix (`sentinel-weald`) and the subdomain label. |
| `admin_email` | `it@weald.org.uk` | First administrator and SES sender. Receives the verification email and owns the first sign-in. |
| `schools` | `Downlands, Patcham` | Optional. Schools to create up front; the admin can add more during onboarding. |
| `app_url` | `https://weald.sentinelwatch.uk` | Optional. Leave blank to use the raw ALB URL until DNS exists. |
| `certificate_arn` | `arn:aws:acm:eu-west-2:…` | Optional ACM cert for the subdomain (HTTP only until set). |

The same thing by hand, if you ever need it — the data step alone against an
already-provisioned stack:

```bash
pnpm --filter @sentinel/db customer:provision \
  --trust "Weald Learning Trust" --trust-slug weald \
  --admin it@weald.org.uk --admin-name "A. Admin" \
  --schools "Downlands, Patcham"
```

## Then: guided onboarding, in-product

Infrastructure provisioning stops at "the trust, the first admin, and maybe some
schools exist." The administrator finishes setup themselves, in the app, at
`/dashboard/admin/onboarding`:

1. **Trust** — already set up (they're signed in as its administrator).
2. **Add schools** — one tenant per school. A school added here is identical to
   one created at provisioning time.
3. **Invite safeguarding leads** — invite a DSL per school (Users page).
   Sign-in stays invite-only; they request a link once invited.
4. **Connect Wonde** — bring in attendance, behaviour and attainment
   (commercialisation slice 3 — shown as pending until then).

Every step is audited. The onboarding checklist shows what is done and what is
still needed, and reports "ready to work" once there is at least one school with
at least one DSL.

## Deferred infra decisions (CTO-DECISION)

The data layer and in-product onboarding are complete. The remaining items are
infrastructure choices to close before onboarding a real customer with real
data; they do not change the application:

- **One account vs account-per-MAT.** This workflow uses one AWS account with a
  per-customer stack prefix and per-customer state. A separate AWS account per
  MAT (via Organizations) is stronger isolation and cleaner billing, at more
  operational overhead. Decide before the first real customer.
- **DNS + TLS per subdomain.** Automating Route 53 records and ACM certificates
  per customer subdomain (today: pass `app_url` + `certificate_arn`, point the
  CNAME by hand).
- **Fleet management.** Rolling a migration or release across *every* customer
  stack, and aggregating health/logs/alerts into one place. Today each stack is
  provisioned and deployed independently; that is fine for a handful of
  customers and needs a control plane past that (see
  `docs/COMMERCIALISATION.md` §1).
- **Customer registry.** A record of customer → stack (slug, subdomain, region,
  version, pupil count) that provisioning writes and billing reads.
- The standing infra items from `infra/README.md`: multi-AZ RDS, a second NAT
  gateway, autoscaling, WAF, and CloudWatch alarms.
