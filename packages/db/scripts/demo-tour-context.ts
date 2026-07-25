import { createHash, randomBytes } from "node:crypto";

import { systemDb } from "../src";

// Prepares a local demo instance for the screenshot tour and prints the context
// the capture step needs (session cookies + the dynamic ids it will visit) as
// JSON on stdout. All human-readable logging goes to stderr so stdout stays
// pure JSON for the pipeline.
//
// This mints real session cookies and writes synthetic inbound mail, so it is
// hard-guarded to a local instance — it refuses to run unless APP_URL points at
// localhost. It only ever touches the demo trust seeded by `db:seed:demo`, and
// every record it writes is synthetic (no real person).
//
// Run via the `demo:tour` pipeline; see tooling/screenshots/README.md.

const DIRECTOR = "director@weald-learning-trust.example";
const ADMIN = "admin@weald-learning-trust.example";
const DSL = "dsl@downlands.example";

const SESSION_TTL_DAYS = 7;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function assertLocal(): void {
  const appUrl = process.env.APP_URL ?? "";
  let host = "";
  try {
    host = new URL(appUrl).hostname;
  } catch {
    host = "";
  }
  const local = host === "localhost" || host === "127.0.0.1" || host === "::1";
  if (!local) {
    console.error(
      `demo-tour-context refuses to run: APP_URL is "${appUrl}", not a local ` +
        `host. This mints session cookies and writes demo mail; run it only ` +
        `against a local demo instance.`,
    );
    process.exit(1);
  }
}

async function mintSession(email: string): Promise<string> {
  const user = await systemDb.user.findFirst({ where: { email } });
  if (!user) throw new Error(`no demo user ${email} — run db:seed:demo first`);
  const token = randomBytes(32).toString("base64url");
  await systemDb.session.create({
    data: {
      tokenHash: hashToken(token),
      userId: user.id,
      tenantId: user.tenantId,
      expiresAt: new Date(Date.now() + SESSION_TTL_DAYS * 864e5),
    },
  });
  return token;
}

// Files a small synthetic exchange onto the busiest open case so the case
// communications timeline shows both an outbound message and a captured reply.
// Idempotent: keyed on stable providerMessageIds (append-only tables, no delete).
async function seedCaseComms(tenantId: string): Promise<string | null> {
  const signal = await systemDb.signal.findFirst({
    where: { tenantId, status: "OPEN" },
    orderBy: { severity: "desc" },
  });
  if (!signal) return null;

  const already = await systemDb.caseMessage.findFirst({
    where: { providerMessageId: "demo-msg-out-1" },
  });
  if (already) return signal.id;

  const base = {
    tenantId,
    signalId: signal.id,
    pupilId: signal.pupilId,
    status: "SENT" as const,
    subject: "Re: Friday absence pattern — pastoral check",
    threadId: "demo-thread-1",
  };
  await systemDb.caseMessage.create({
    data: {
      ...base,
      direction: "OUTBOUND",
      fromAddress: "safeguarding@downlands.example",
      toAddresses: ["j.okafor@downlands.example"],
      body: "Thanks for flagging. I've opened a case file and scheduled a pastoral review. Could you share what you've observed in lessons?",
      providerMessageId: "demo-msg-out-1",
      createdAt: new Date(Date.now() - 180 * 60_000),
    },
  });
  await systemDb.caseMessage.create({
    data: {
      ...base,
      direction: "INBOUND",
      fromAddress: "j.okafor@downlands.example",
      toAddresses: ["safeguarding@downlands.example"],
      body: "In class they're engaged Mon–Thu but quiet on Fridays, and have mentioned not wanting to go to Friday PE. Happy to keep an eye and feed back.",
      providerMessageId: "demo-msg-in-1",
      createdAt: new Date(Date.now() - 60 * 60_000),
    },
  });
  return signal.id;
}

// Populates the intake queue with a few unmatched inbound messages so the
// email-capture surface is demonstrative. Idempotent on providerMessageId.
async function seedIntake(tenantId: string): Promise<void> {
  const items = [
    {
      providerMessageId: "demo-intake-1",
      fromAddress: "j.okafor@downlands.example",
      subject: "Worried about a Year 9 pupil — kept to themselves all week",
      body: "Hi, I teach form 9C. One of mine has been very withdrawn since half term and skipped lunch three days running. Could you take a look? I didn't want to name them over email. Thanks, James",
      minsAgo: 24,
    },
    {
      providerMessageId: "demo-intake-2",
      fromAddress: "reception@downlands.example",
      subject: "Parent called re: after-school pickup arrangements",
      body: "A parent phoned about a change to who collects their child. Passing to safeguarding to note on the right record — didn't want to guess which pupil.",
      minsAgo: 95,
    },
    {
      providerMessageId: "demo-intake-3",
      fromAddress: "senco@downlands.example",
      subject: "Chronology note for Pupil 4021",
      body: "Adding context to an existing concern — recent EHCP review flagged attendance dipping on PE days. Please file against their case.",
      minsAgo: 210,
    },
  ];
  for (const it of items) {
    const exists = await systemDb.intakeItem.findFirst({
      where: { providerMessageId: it.providerMessageId },
    });
    if (exists) continue;
    await systemDb.intakeItem.create({
      data: {
        tenantId,
        toAddress: "safeguarding@downlands.example",
        status: "PENDING",
        fromAddress: it.fromAddress,
        subject: it.subject,
        body: it.body,
        providerMessageId: it.providerMessageId,
        receivedAt: new Date(Date.now() - it.minsAgo * 60_000),
      },
    });
  }
}

async function main() {
  assertLocal();

  const school = await systemDb.tenant.findUnique({
    where: { slug: "downlands" },
  });
  if (!school) throw new Error("no downlands school — run db:seed:demo first");

  await seedIntake(school.id);
  const caseSignalId = await seedCaseComms(school.id);
  const doc = await systemDb.document.findFirst({
    where: { tenantId: school.id },
  });

  const context = {
    sessions: {
      director: await mintSession(DIRECTOR),
      admin: await mintSession(ADMIN),
      dsl: await mintSession(DSL),
    },
    schoolId: school.id,
    caseSignalId,
    docId: doc?.id ?? null,
  };

  console.error("demo-tour-context ready (synthetic data, local instance).");
  console.log(JSON.stringify(context));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
