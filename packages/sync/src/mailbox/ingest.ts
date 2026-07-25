import { systemDb } from "@sentinel/db";

import type { InboundMessage } from "./connector";

// Inbound capture (commercialisation slice 4, phase 2). An inbound safeguarding
// message is matched to a case and recorded as an INBOUND CaseMessage; if it
// can't be matched confidently, it lands in the intake queue for a DSL to
// assign. So a teacher's emailed concern is captured against the child instead
// of sitting unread. Idempotent by the provider's message id — the same message
// is never ingested twice. Reads only what it needs; the human still decides.

export type IngestResult =
  | { outcome: "matched"; signalId: string; caseMessageId: string }
  | { outcome: "intake"; intakeItemId: string }
  | { outcome: "duplicate" };

// Finds the single pupil a message refers to by a sealed reference — the
// "Pupil ####" form the platform uses everywhere (the last four of the UPN). A
// reply to one of our alerts or referrals carries it. Only a UNIQUE match is
// used; if two pupils share those four digits it is ambiguous, so the message
// goes to intake rather than risk mis-filing against the wrong child.
async function matchPupilByReference(
  tenantId: string,
  text: string,
): Promise<string | null> {
  const found = new Set<string>();
  for (const m of text.matchAll(/\bPupil\s+(\d{4})\b/gi)) {
    found.add(m[1]!);
  }
  for (const last4 of found) {
    const pupils = await systemDb.pupil.findMany({
      where: { tenantId, upn: { endsWith: last4 } },
      select: { id: true },
      take: 2,
    });
    if (pupils.length === 1) return pupils[0]!.id;
  }
  return null;
}

async function alreadyIngested(
  tenantId: string,
  providerMessageId: string,
): Promise<boolean> {
  const [asMessage, asIntake] = await Promise.all([
    systemDb.caseMessage.findFirst({
      where: { tenantId, providerMessageId },
      select: { id: true },
    }),
    systemDb.intakeItem.findUnique({
      where: { providerMessageId },
      select: { id: true },
    }),
  ]);
  return asMessage !== null || asIntake !== null;
}

export async function ingestInbound(
  tenantId: string,
  msg: InboundMessage,
): Promise<IngestResult> {
  if (msg.providerMessageId && (await alreadyIngested(tenantId, msg.providerMessageId))) {
    return { outcome: "duplicate" };
  }

  // Match order: an explicit thread (a reply to a message we sent or received),
  // then a sealed pupil reference in the subject/body.
  let signalId: string | null = null;
  let pupilId: string | null = null;

  if (msg.threadId) {
    const prior = await systemDb.caseMessage.findFirst({
      where: { tenantId, threadId: msg.threadId },
      orderBy: { createdAt: "desc" },
      select: { signalId: true, pupilId: true },
    });
    if (prior) {
      signalId = prior.signalId;
      pupilId = prior.pupilId;
    }
  }

  if (!signalId) {
    const matchedPupilId = await matchPupilByReference(
      tenantId,
      `${msg.subject}\n${msg.body}`,
    );
    if (matchedPupilId) {
      const signal = await systemDb.signal.findFirst({
        where: { tenantId, pupilId: matchedPupilId },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      if (signal) {
        signalId = signal.id;
        pupilId = matchedPupilId;
      }
    }
  }

  if (signalId && pupilId) {
    const message = await systemDb.caseMessage.create({
      data: {
        tenantId,
        signalId,
        pupilId,
        direction: "INBOUND",
        status: "SENT", // recorded successfully
        fromAddress: msg.from,
        toAddresses: [msg.to],
        subject: msg.subject,
        body: msg.body,
        threadId: msg.threadId ?? null,
        providerMessageId: msg.providerMessageId ?? null,
      },
    });
    await systemDb.auditEvent.create({
      data: {
        tenantId,
        userId: null,
        action: "case.message.received",
        entityType: "signal",
        entityId: signalId,
        pupilId,
        metadata: { from: msg.from, via: "mailbox" },
      },
    });
    return { outcome: "matched", signalId, caseMessageId: message.id };
  }

  // Unmatched — hand it to a DSL.
  const intake = await systemDb.intakeItem.create({
    data: {
      tenantId,
      fromAddress: msg.from,
      toAddress: msg.to,
      subject: msg.subject,
      body: msg.body,
      threadId: msg.threadId ?? null,
      providerMessageId: msg.providerMessageId ?? null,
      receivedAt: msg.receivedAt,
    },
  });
  await systemDb.auditEvent.create({
    data: {
      tenantId,
      userId: null,
      action: "intake.received",
      entityType: "intake",
      entityId: intake.id,
      metadata: { from: msg.from, via: "mailbox" },
    },
  });
  return { outcome: "intake", intakeItemId: intake.id };
}
