import Link from "next/link";
import { redirect } from "next/navigation";

import { dbForTenant } from "@sentinel/db";

import { BrandLockup } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { getAuthSession } from "@/server/auth/session";

export const metadata = { title: "Dashboard" };

const NAV = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/signals", label: "Signals" },
  { href: "/dashboard/audit", label: "Audit log" },
];

// Protected area. DESIGN.md layout: left sidebar in forest-deep for
// navigation and identity; the content pane stays cream for legibility.
// No top-and-side double navigation.
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
      <aside className="flex w-60 shrink-0 flex-col bg-forest-deep text-cream">
        <div className="px-6 pb-6 pt-8">
          <BrandLockup markVariant="cobalt" wordmarkClassName="text-cream" />
          <div className="mt-1 text-xs text-cream/70">
            {tenant ? tenant.name : "No school assigned yet"}
          </div>
        </div>
        <nav className="flex flex-col gap-1 px-3" aria-label="Main">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-3 text-sm text-cream/90 transition-colors duration-150 hover:bg-forest hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream/80"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-3 border-t border-forest px-6 py-5">
          <span className="break-all text-xs text-cream/70">
            {session.user.email}
          </span>
          <form action="/api/auth/sign-out" method="post">
            <Button
              type="submit"
              size="sm"
              className="w-full border border-forest bg-transparent text-cream hover:bg-forest"
            >
              Sign out
            </Button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-[1200px] px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
