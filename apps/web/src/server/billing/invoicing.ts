import { randomUUID } from "node:crypto";

// Invoicing provider (commercialisation slice 5). The metering + line
// computation is real and tested; the payment provider is stubbed behind this
// interface so the DRAFT → ISSUED lifecycle works end to end without a live
// account.
//
// CTO-DECISION: wire a real provider (Stripe or equivalent) — create a Customer
// per trust (stored on BillingAccount.stripeCustomerId), raise an Invoice with
// a per-pupil usage line and the flat MAT line, and reconcile paid status via
// webhook. The stub returns a deterministic-shaped id so the flow is exercised;
// no money moves.

export type InvoiceRequest = {
  trustId: string;
  amountPence: number;
  currency: string;
  description: string;
};

export type InvoiceResult = { stripeInvoiceId: string };

export type Invoicer = (request: InvoiceRequest) => Promise<InvoiceResult>;

// The stub: no external call, no charge. Shapes an id like the real provider's.
const stubInvoicer: Invoicer = () =>
  Promise.resolve({ stripeInvoiceId: `in_stub_${randomUUID().slice(0, 12)}` });

let invoicer: Invoicer = stubInvoicer;

// Tests (and a future real provider) substitute the invoicer here.
export function setInvoicerForTesting(override: Invoicer | null): void {
  invoicer = override ?? stubInvoicer;
}

export function raiseInvoice(request: InvoiceRequest): Promise<InvoiceResult> {
  return invoicer(request);
}
