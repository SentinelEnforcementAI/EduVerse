import { Inbox } from "lucide-react";

import { serverApi } from "@/trpc/server";

import { IntakeRow } from "./intake-client";

// The intake queue (commercialisation slice 4, phase 2: inbound capture).
// Inbound safeguarding mail that couldn't be matched to a case automatically
// waits here for a DSL to assign it to the right child's case, or dismiss it.
// So a teacher's emailed concern is never lost in an unread inbox.
export default async function IntakePage({
  params,
}: {
  params: Promise<{ schoolId: string }>;
}) {
  const { schoolId } = await params;
  const api = await serverApi();
  const { items, cases } = await api.intake.list({ schoolId });

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Intake</h1>
      <p className="mt-1 text-base text-muted-foreground">
        Inbound safeguarding mail that didn’t match a case automatically. Assign
        each to the right case, or dismiss it — nothing slips through the gaps.
      </p>

      {items.length === 0 ? (
        <div className="mt-6 flex items-center gap-3 rounded-xl border border-cloud bg-card px-5 py-8 text-muted-foreground">
          <Inbox className="size-5" aria-hidden />
          <span>
            Nothing waiting. Matched mail is threaded straight onto its case;
            only mail that needs a human decision appears here.
          </span>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {items.map((item) => (
            <IntakeRow
              key={item.id}
              item={item}
              schoolId={schoolId}
              cases={cases}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
