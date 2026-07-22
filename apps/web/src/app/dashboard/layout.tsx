import { redirect } from "next/navigation";

import { dbForTenant } from "@sentinel/db";

import { BrandLockup } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { getAuthSession } from "@/server/auth/session";

import { DashboardNav } from "./nav";

export const metadata = { title: "Dashboard" };

// Protected area. DESIGN.md v2 layout: white sidebar with the brand
// lock-up, cobalt tint on the active item, org context pinned at the
// bottom; content on paper, 24px gutters, max width 1440px.
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAuthSession();
  if (!session) {
    redirect("/sign-in");
  }

  const tenant = session.user.tenantId
    ? await dbForTenant(session.user.tenantId).tenant.findUnique({
        where: { id: session.user.tenantId },
      })
    : null;

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 shrink-0 flex-col border-r bg-card">
        <div className="px-6 pb-6 pt-7">
          <BrandLockup markVariant="cobalt" />
        </div>
        <DashboardNav />
        <div className="mt-auto flex flex-col gap-3 border-t px-6 py-5">
          <div className="flex flex-col gap-0.5">
            <span className="text-base font-medium">
              {tenant ? tenant.name : "No school assigned yet"}
            </span>
            <span className="break-all text-xs text-muted-foreground">
              {session.user.email}
            </span>
          </div>
          <form action="/api/auth/sign-out" method="post">
            <Button type="submit" variant="secondary" size="sm" className="w-full">
              Sign out
            </Button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-[1440px] px-6 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
