import { SendEmailCommand, SESv2Client } from "@aws-sdk/client-sesv2";

// Sends a proactive alert email from the worker (commercialisation slice 6).
// Mail stays inside UK infrastructure: SES in eu-west-2, hardcoded (data
// residency). Selection follows EMAIL_TRANSPORT, mirroring the web app's
// transports; tests substitute a fake sender via setAlertSenderForTesting.

const SES_REGION = "eu-west-2" as const;

export type AlertEmail = {
  from: string;
  to: string;
  subject: string;
  body: string;
};

export type AlertSender = (email: AlertEmail) => Promise<void>;

let sesClient: SESv2Client | null = null;

function getSesClient(): SESv2Client {
  sesClient ??= new SESv2Client({ region: SES_REGION });
  return sesClient;
}

async function sendViaSes(email: AlertEmail): Promise<void> {
  await getSesClient().send(
    new SendEmailCommand({
      FromEmailAddress: email.from,
      Destination: { ToAddresses: [email.to] },
      Content: {
        Simple: {
          Subject: { Data: email.subject },
          Body: { Text: { Data: email.body } },
        },
      },
    }),
  );
}

function sendViaConsole(email: AlertEmail): Promise<void> {
  console.info(
    `[alert] ${email.subject} → ${email.to} (console transport)`,
  );
  return Promise.resolve();
}

let senderOverride: AlertSender | null = null;

export function setAlertSenderForTesting(override: AlertSender | null): void {
  senderOverride = override;
}

export async function sendAlertEmail(email: AlertEmail): Promise<void> {
  if (senderOverride) {
    await senderOverride(email);
    return;
  }
  if (process.env.EMAIL_TRANSPORT === "ses") {
    await sendViaSes(email);
    return;
  }
  await sendViaConsole(email);
}
