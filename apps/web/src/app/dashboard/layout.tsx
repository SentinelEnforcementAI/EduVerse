import Link from "next/link";
import { redirect } from "next/navigation";

import { dbForTenant } from "@sentinel/db";

import { Button } from "@/components/ui/button";
import { getAuthSession } from "@/server/auth/session";

export const metadata = { title: "Dashboard" };

// Protected area: every route under /dashboard requires a valid session,
// enforced server-side before anything renders.
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAuthSession();
  if (!session) {
    redirect("/sign-in");
  }

  // Fetched through the tenant-scoped client: RLS guarantees this can only
  // ever be the signed-in user's own school.
  const tenant = session.user.tenantId
    ? await dbForTenant(session.user.tenantId).tenant.findUnique({
        where: { id: session.user.tenantId },
      })
    : null;

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-baseline gap-4">
            <span className="font-semibold">Sentinel Watch</span>
            <span className="text-sm text-muted-foreground">
              {tenant ? tenant.name : "No school assigned yet"}
            </span>
            <nav className="flex items-baseline gap-3 text-sm">
              <Link href="/dashboard" className="hover:underline">
                Overview
              </Link>
              <Link href="/dashboard/signals" className="hover:underline">
                Signals
              </Link>
              <Link href="/dashboard/audit" className="hover:underline">
                Audit log
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {session.user.email}
            </span>
            <form action="/api/auth/sign-out" method="post">
              <Button type="submit" variant="outline" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
        {children}
      </main>
    </div>
  );
}
