"use client";

import { useRouter } from "next/navigation";
import { CalendarPlus, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { api } from "@/trpc/react";

type Snapshot = {
  id: string;
  periodStart: Date | string;
  periodEnd: Date | string;
  pupilCount: number;
  totalPence: number;
  currency: string;
  invoiceStatus: "DRAFT" | "ISSUED" | "PAID" | "VOID";
  stripeInvoiceId: string | null;
};

function period(start: Date | string): string {
  return new Date(start).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
}

const STATUS_STYLE: Record<Snapshot["invoiceStatus"], string> = {
  DRAFT: "bg-cloud text-muted-foreground",
  ISSUED: "bg-cobalt-tint text-cobalt",
  PAID: "bg-success-tint text-success",
  VOID: "bg-cloud text-muted-foreground",
};

// Take a snapshot for the current month.
export function TakeSnapshot() {
  const router = useRouter();
  const take = api.billing.takeSnapshot.useMutation({
    onSuccess: () => router.refresh(),
  });
  return (
    <div>
      <Button
        size="sm"
        disabled={take.isPending}
        onClick={() => take.mutate(undefined)}
      >
        <CalendarPlus className="size-4" aria-hidden />
        {take.isPending ? "Metering…" : "Snapshot this month"}
      </Button>
      {take.error ? (
        <p className="mt-2 text-sm text-risk">{take.error.message}</p>
      ) : null}
    </div>
  );
}

// The metered periods, with an issue-invoice action on each draft.
export function SnapshotList({ snapshots }: { snapshots: Snapshot[] }) {
  const router = useRouter();
  const issue = api.billing.issueInvoice.useMutation({
    onSuccess: () => router.refresh(),
  });

  if (snapshots.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No periods metered yet. Snapshot this month to record a billing period.
      </p>
    );
  }

  return (
    <ul className="overflow-hidden rounded-xl border border-cloud bg-card">
      {snapshots.map((s) => (
        <li
          key={s.id}
          className="flex flex-wrap items-center gap-3 border-b border-cloud px-4 py-3 last:border-b-0"
        >
          <div className="min-w-40">
            <div className="font-medium">{period(s.periodStart)}</div>
            <div className="text-xs text-muted-foreground">
              {s.pupilCount} pupils
            </div>
          </div>
          <div className="font-semibold tabular-nums">
            {formatMoney(s.totalPence, s.currency)}
          </div>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[s.invoiceStatus]}`}
          >
            {s.invoiceStatus.charAt(0) + s.invoiceStatus.slice(1).toLowerCase()}
          </span>
          <div className="ml-auto">
            {s.invoiceStatus === "DRAFT" ? (
              <Button
                size="sm"
                variant="secondary"
                disabled={issue.isPending}
                onClick={() => issue.mutate({ snapshotId: s.id })}
              >
                <FileText className="size-4" aria-hidden />
                Issue invoice
              </Button>
            ) : s.stripeInvoiceId ? (
              <span className="text-xs text-muted-foreground">
                {s.stripeInvoiceId}
              </span>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
