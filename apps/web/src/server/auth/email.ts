import { env } from "@/env";

export type MagicLinkEmail = {
  to: string;
  url: string;
};

// CTO-DECISION: production email provider. AWS SES in eu-west-2 keeps email
// dispatch inside UK infrastructure (data residency principle). Add an "ses"
// transport here when decided — callers depend only on this function.
export async function sendMagicLinkEmail({
  to,
  url,
}: MagicLinkEmail): Promise<void> {
  if (env.EMAIL_TRANSPORT === "console") {
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
    return;
  }
  throw new Error(`Unsupported email transport: ${env.EMAIL_TRANSPORT}`);
}
