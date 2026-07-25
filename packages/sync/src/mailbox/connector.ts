// The mailbox connector (commercialisation slice 4, phase 2: inbound capture).
// A school's DEDICATED safeguarding mailbox (e.g. safeguarding@school.org.uk)
// is connected via Microsoft 365 Graph or Google Workspace OAuth, scoped to
// that mailbox only — never a DSL's personal inbox. The worker polls (or
// receives webhooks) and hands each message to ingestInbound().
//
// ── DPIA GATE (CTO-DECISION) ────────────────────────────────────────────────
// Inbound mail bodies about children are special-category data — the biggest
// data-protection surface in the product. Connecting a real mailbox is gated on
// Fieldfisher's DPIA/DPA explicitly covering it (CLAUDE.md; docs/COMMERCIALISATION.md
// §2). Until that is signed and a provider is wired, no real mailbox is polled:
// the connector is a stub that returns nothing, and the ingestion + intake
// pipeline below is exercised with synthetic messages only. Wiring Graph /
// Workspace OAuth (per-tenant token in Secrets Manager, scoped to the one
// mailbox) is the remaining integration, mirroring the Wonde self-connect seam.

export type InboundMessage = {
  from: string;
  to: string;
  subject: string;
  body: string;
  // The provider's conversation/thread id and message id, when available —
  // used to thread a reply onto an existing case and to dedupe ingestion.
  threadId?: string | null;
  providerMessageId?: string | null;
  receivedAt: Date;
};

export interface MailboxConnector {
  // New messages for a tenant's connected mailbox since the last poll.
  fetchNew(tenantId: string): Promise<InboundMessage[]>;
}

// The gated default: no mailbox is connected, so nothing is fetched. A real
// deployment injects a Graph/Workspace connector here once the DPIA is signed.
const disconnectedConnector: MailboxConnector = {
  fetchNew: () => Promise.resolve([]),
};

let connector: MailboxConnector = disconnectedConnector;

export function setMailboxConnectorForTesting(
  override: MailboxConnector | null,
): void {
  connector = override ?? disconnectedConnector;
}

export function getMailboxConnector(): MailboxConnector {
  return connector;
}
