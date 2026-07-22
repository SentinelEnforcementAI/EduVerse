import { SendEmailCommand, SESv2Client } from "@aws-sdk/client-sesv2";

import { env } from "@/env";

// Email dispatch stays inside UK infrastructure (data residency principle):
// SES in eu-west-2, hardcoded — not configurable, by design.
export const SES_REGION = "eu-west-2" as const;

export type MagicLinkEmail = {
  to: string;
  url: string;
};

export type EmailSender = (message: MagicLinkEmail) => Promise<void>;

let sesClient: SESv2Client | null = null;

function getSesClient(): SESv2Client {
  sesClient ??= new SESv2Client({ region: SES_REGION });
  return sesClient;
}

async function sendViaSes({ to, url }: MagicLinkEmail): Promise<void> {
  await getSesClient().send(
    new SendEmailCommand({
      FromEmailAddress: env.EMAIL_FROM,
      Destination: { ToAddresses: [to] },
      Content: {
        Simple: {
          Subject: { Data: "Your Sentinel Watch sign-in link" },
          Body: {
            Text: {
              Data: [
                "Sign in to Sentinel Watch with the link below. It works",
                "once and expires in 15 minutes.",
                "",
                url,
                "",
                "If you did not request this, you can ignore this email.",
              ].join("\n"),
            },
          },
        },
      },
    }),
  );
}

function sendViaConsole({ to, url }: MagicLinkEmail): Promise<void> {
  console.info(
    [
      "",
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      "Sentinel Watch — magic link (dev console transport)",
      `To:   ${to}`,
      `Link: ${url}`,
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      "",
    ].join("\n"),
  );
  return Promise.resolve();
}

// Indirection so tests can substitute a fake sender. Production selection is
// driven by EMAIL_TRANSPORT; the override is only reachable from test code.
let senderOverride: EmailSender | null = null;

export function setEmailSenderForTesting(override: EmailSender | null): void {
  senderOverride = override;
}

export async function sendMagicLinkEmail(
  message: MagicLinkEmail,
): Promise<void> {
  if (senderOverride) {
    await senderOverride(message);
    return;
  }
  if (env.EMAIL_TRANSPORT === "ses") {
    await sendViaSes(message);
    return;
  }
  await sendViaConsole(message);
}
