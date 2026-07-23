import { redirect } from "next/navigation";

import { resolveTenancy } from "@sentinel/db";

import { getAuthSession } from "@/server/auth/session";

import { ShellFooter } from "./shell/footer";
import { ShellHeader, type HeaderLink } from "./shell/header";

export const metadata = { title: "Sentinel Watch" };

// The application shell (spec section 4): header, content on paper, footer.
// This replaces the earlier left sidebar — navigation is the header cluster and
// breadcrumbs, the way the reference works.
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAuthSession();
  if (!session) {
    redirect("/sign-in");
  }

  const tenancy = await resolveTenancy(session.user);
  const isDirector = tenancy.mode === "mat";

  // A director oversees the trust; a DSL works within their one school. Only
  // surfaces that exist today appear — the school-scoped Signals and Audit log
  // are DSL surfaces (they read the caller's single tenant), so they show for a
  // DSL and not at trust level, where the equivalents arrive with later slices.
  const roleLabel = isDirector
    ? "Director of Safeguarding"
    : `DSL${tenancy.schools[0] ? `, ${tenancy.schools[0].name}` : ""}`;

  const dslSchoolId = tenancy.schools[0]?.id;
  // On-call and governance serve both modes (on-call resolves the caller's
  // scope; governance is system-wide).
  const common: HeaderLink[] = [
    { href: "/dashboard/oncall", label: "On-call" },
    { href: "/dashboard/governance", label: "Governance" },
  ];
  const links: HeaderLink[] =
    isDirector || !dslSchoolId
      ? common
      : [
          {
            href: `/dashboard/school/${dslSchoolId}/triage/active`,
            label: "Triage",
          },
          {
            href: `/dashboard/school/${dslSchoolId}/documents`,
            label: "Documents",
          },
          {
            href: `/dashboard/school/${dslSchoolId}/inspection`,
            label: "Inspection",
          },
          ...common,
          { href: "/dashboard/audit", label: "Audit log" },
        ];

  const displayName = session.user.name ?? session.user.email;

  return (
    <div className="flex min-h-screen flex-col">
      <ShellHeader
        name={displayName}
        roleLabel={roleLabel}
        links={links}
        showSwitch={isDirector}
      />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-[1280px] px-6 py-8">{children}</div>
      </main>
      <ShellFooter />
    </div>
  );
}
