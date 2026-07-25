import { systemDb } from "@sentinel/db";

import { sendAlertEmail } from "./mailer";

// Proactive notifications (commercialisation slice 6): the moment the rules
// engine raises a serious signal, tell the school's DSLs to review it — rather
// than relying on someone checking the dashboard. Runs after each rules run
// (see rules-queue). Idempotent: one alert per recipient per signal, so a
// re-run never re-alerts. Sealed: the alert references the pupil by sealed ref
// and links to the case; it never carries a name. Every send is audited.

// The sealed pupil reference — "Pupil " + the last four of the UPN. Mirrors the
// web app's canonical sealPupilRef (server/identity); kept here so the worker
// does not depend on the web app.
function sealPupilRef(upn: string): string {
  return `Pupil ${upn.slice(-4)}`;
}

function senderAddress(): string {
  return process.env.EMAIL_FROM ?? "Sentinel Watch <safeguarding@sentinelwatch.uk>";
}

function caseUrl(schoolId: string, signalId: string): string {
  const base = (process.env.APP_URL ?? "").replace(/\/+$/, "");
  const path = `/dashboard/school/${schoolId}/case/${signalId}`;
  return base ? `${base}${path}` : path;
}

export type DispatchResult = { alerted: number; failed: number };

// Sends alerts for every serious, still-open signal in a school that a DSL has
// not yet been alerted about. Returns how many alerts were sent / failed.
export async function dispatchSeriousSignalAlerts(
  tenantId: string,
): Promise<DispatchResult> {
  const signals = await systemDb.signal.findMany({
    where: { tenantId, serious: true, status: "OPEN" },
    select: {
      id: true,
      pupilId: true,
      title: true,
      pupil: { select: { upn: true } },
    },
  });
  if (signals.length === 0) return { alerted: 0, failed: 0 };

  const school = await systemDb.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true },
  });
  const dsls = await systemDb.user.findMany({
    where: { tenantId, role: "DSL", status: "ACTIVE" },
    select: { id: true, email: true },
  });
  if (dsls.length === 0) return { alerted: 0, failed: 0 };

  // Who has already been alerted, so a re-run does not re-send.
  const existing = await systemDb.notification.findMany({
    where: {
      tenantId,
      channel: "EMAIL",
      signalId: { in: signals.map((s) => s.id) },
    },
    select: { signalId: true, userId: true },
  });
  const alreadyAlerted = new Set(existing.map((n) => `${n.signalId}:${n.userId}`));

  const from = senderAddress();
  let alerted = 0;
  let failed = 0;

  for (const signal of signals) {
    const sealedRef = sealPupilRef(signal.pupil.upn);
    const subject = "Serious safeguarding signal — review needed";
    const link = caseUrl(tenantId, signal.id);
    const body = [
      `A serious safeguarding signal has been raised for ${sealedRef}`,
      school?.name ? `at ${school.name}.` : ".",
      "",
      "Please review it in Sentinel Watch:",
      link,
      "",
      "This alert is sealed — the pupil is identified only inside the case,",
      "where revealing their identity is recorded.",
    ].join("\n");

    for (const dsl of dsls) {
      if (alreadyAlerted.has(`${signal.id}:${dsl.id}`)) continue;

      let sendError = false;
      try {
        await sendAlertEmail({ from, to: dsl.email, subject, body });
      } catch {
        sendError = true;
      }

      await systemDb.notification.create({
        data: {
          tenantId,
          signalId: signal.id,
          pupilId: signal.pupilId,
          userId: dsl.id,
          channel: "EMAIL",
          status: sendError ? "FAILED" : "SENT",
          toAddress: dsl.email,
          subject,
        },
      });
      await systemDb.auditEvent.create({
        data: {
          tenantId,
          userId: null,
          action: sendError ? "notification.failed" : "notification.sent",
          entityType: "signal",
          entityId: signal.id,
          pupilId: signal.pupilId,
          metadata: { channel: "email", recipient: dsl.id },
        },
      });

      if (sendError) failed++;
      else alerted++;
    }
  }

  return { alerted, failed };
}
