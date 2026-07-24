import { SendEmailCommand, SESv2Client } from "@aws-sdk/client-sesv2";

import { env } from "@/env";
import { SES_REGION } from "@/server/auth/email";

// Sends a case communication a human reviewed and chose to send (slice 4: email
// mission control, phase 1 — outbound). Mail stays inside UK infrastructure:
// SES in eu-west-2, hardcoded (data residency). Phase 1 sends from the verified
// SES sender (a verified subdomain); phase 2 will send via the school's own
// connected mailbox (Graph / Workspace) so mail leaves from their domain.
//
// This never sends on its own — every call originates from a user action in the
// messages router. Human-in-the-loop is structural: the machine drafts, the
// person sends.

export type CaseEmail = {
  from: string;
  to: string[];
  subject: string;
  body: string;
};

export type CaseEmailResult = { providerMessageId: string | null };

export type CaseEmailSender = (email: CaseEmail) => Promise<CaseEmailResult>;

let sesClient: SESv2Client | null = null;

function getSesClient(): SESv2Client {
  sesClient ??= new SESv2Client({ region: SES_REGION });
  return sesClient;
}

async function sendViaSes(email: CaseEmail): Promise<CaseEmailResult> {
  const out = await getSesClient().send(
    new SendEmailCommand({
      FromEmailAddress: email.from,
      Destination: { ToAddresses: email.to },
      Content: {
        Simple: {
          Subject: { Data: email.subject },
          Body: { Text: { Data: email.body } },
        },
      },
    }),
  );
  return { providerMessageId: out.MessageId ?? null };
}

function sendViaConsole(email: CaseEmail): Promise<CaseEmailResult> {
  console.info(
    [
      "",
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      "Sentinel Watch — case message (dev console transport)",
      `From:    ${email.from}`,
      `To:      ${email.to.join(", ")}`,
      `Subject: ${email.subject}`,
      "",
      email.body,
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      "",
    ].join("\n"),
  );
  return Promise.resolve({ providerMessageId: null });
}

// Indirection so tests substitute a fake sender (and assert what would be sent
// without any network). Production selection is driven by EMAIL_TRANSPORT.
let senderOverride: CaseEmailSender | null = null;

export function setCaseEmailSenderForTesting(
  override: CaseEmailSender | null,
): void {
  senderOverride = override;
}

export async function sendCaseEmail(email: CaseEmail): Promise<CaseEmailResult> {
  if (senderOverride) return senderOverride(email);
  if (env.EMAIL_TRANSPORT === "ses") return sendViaSes(email);
  return sendViaConsole(email);
}
