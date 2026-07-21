import { dbForTenant } from "@sentinel/db";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAuthSession } from "@/server/auth/session";

import { SystemStatus } from "./system-status";

export default async function DashboardPage() {
  const session = await getAuthSession();
  const pupilCount = session?.user.tenantId
    ? await dbForTenant(session.user.tenantId).pupil.count()
    : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome{session?.user.name ? `, ${session.user.name}` : ""}
        </h1>
        <p className="text-muted-foreground">
          Signals for your school will appear here once the risk engine is
          live.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Pupils on roll</CardTitle>
            <CardDescription>
              Synthetic data for development — no real pupil data until DPAs
              are signed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pupilCount === null ? (
              <span className="text-sm text-muted-foreground">
                No school assigned yet.
              </span>
            ) : (
              <span className="text-3xl font-semibold">{pupilCount}</span>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Signals</CardTitle>
            <CardDescription>
              Flagged pupils and their reasoning arrive with build steps 5–6.
              Nothing is actioned without a DSL&apos;s decision.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            No signals yet.
          </CardContent>
        </Card>
        <SystemStatus />
      </div>
    </div>
  );
}
