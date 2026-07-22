import Link from "next/link";
import { TRPCError } from "@trpc/server";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { serverApi } from "@/trpc/server";

export const metadata = { title: "Audit log" };

function auditUrl(page: number, action?: string): string {
  const params = new URLSearchParams();
  if (page > 0) params.set("page", String(page));
  if (action) params.set("action", action);
  const query = params.toString();
  return `/dashboard/audit${query ? `?${query}` : ""}`;
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; action?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(0, Number(params.page ?? "0") || 0);
  const action = params.action || undefined;

  const api = await serverApi();
  let result;
  try {
    result = await api.audit.list({ page, action });
  } catch (error) {
    if (error instanceof TRPCError && error.code === "FORBIDDEN") {
      return (
        <Card>
          <CardHeader>
            <CardTitle>No school assigned</CardTitle>
            <CardDescription>
              Your account is not attached to a school yet.
            </CardDescription>
          </CardHeader>
        </Card>
      );
    }
    throw error;
  }

  const lastPage = Math.max(0, Math.ceil(result.total / result.pageSize) - 1);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif text-2xl font-bold tracking-tight">
          Audit log
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every read and write against a child&apos;s record: who, what, when.
          Entries are permanent — they can never be edited or deleted, and
          viewing this log is itself recorded.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Link
          href={auditUrl(0)}
          className={
            !action
              ? "rounded-full bg-primary px-4 py-2.5 font-bold tabular-nums text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              : "rounded-full border px-4 py-2.5 tabular-nums text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          }
        >
          All ({result.total})
        </Link>
        {result.availableActions.map((availableAction) => (
          <Link
            key={availableAction}
            href={auditUrl(0, availableAction)}
            className={
              action === availableAction
                ? "rounded-full bg-primary px-4 py-2.5 font-bold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                : "rounded-full border px-4 py-2.5 text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            }
          >
            {availableAction}
          </Link>
        ))}
      </div>

      {/* Audit entries are deliberately boring (DESIGN.md): plain Lato at
          12/14, no status colour, no drama. */}
      <Card>
        <CardContent className="pt-6">
          {result.events.length === 0 ? (
            <p className="text-sm text-muted-foreground">No entries.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-3 pr-4 font-bold">When</th>
                    <th className="py-3 pr-4 font-bold">Who</th>
                    <th className="py-3 pr-4 font-bold">Action</th>
                    <th className="py-3 pr-4 font-bold">Pupil</th>
                    <th className="py-3 font-bold">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {result.events.map((event) => (
                    <tr key={event.id} className="border-b last:border-0">
                      <td className="whitespace-nowrap py-3 pr-4 tabular-nums text-muted-foreground">
                        {event.createdAt.toLocaleString("en-GB")}
                      </td>
                      <td className="py-3 pr-4">{event.user}</td>
                      <td className="py-3 pr-4 text-xs">{event.action}</td>
                      <td className="py-3 pr-4">{event.pupil ?? "—"}</td>
                      <td className="py-3 text-xs text-muted-foreground">
                        {event.metadata
                          ? JSON.stringify(event.metadata)
                          : event.entityId ?? ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        {page > 0 ? (
          <Button asChild variant="outline" size="sm">
            <Link href={auditUrl(page - 1, action)}>Previous</Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            Previous
          </Button>
        )}
        <span className="text-sm tabular-nums text-muted-foreground">
          Page {page + 1} of {lastPage + 1}
        </span>
        {page < lastPage ? (
          <Button asChild variant="outline" size="sm">
            <Link href={auditUrl(page + 1, action)}>Next</Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            Next
          </Button>
        )}
      </div>
    </div>
  );
}
