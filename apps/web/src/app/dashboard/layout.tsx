import { redirect } from "next/navigation";
import {
  Bell,
  Building2,
  CreditCard,
  FileBarChart,
  FileText,
  Flag,
  FolderOpen,
  LayoutDashboard,
  LineChart,
  Rocket,
  ScrollText,
  SearchCheck,
  ShieldCheck,
  Users,
} from "lucide-react";

import { resolveTenancy } from "@sentinel/db";

import { getAuthSession } from "@/server/auth/session";
import { serverApi } from "@/trpc/server";

import { ShellFooter } from "./shell/footer";
import { Sidebar, type NavItem, type QuickAction } from "./shell/sidebar";
import { Topbar } from "./shell/topbar";

export const metadata = { title: "Sentinel Watch" };

// The application shell (spec section 4): a persistent left sidebar frames every
// screen, with a top bar for search and alerts and a footer on paper. One shell
// everywhere, so navigation, identity and quick actions are always in reach.
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
  const isAdmin = session.user.role === "ADMIN";
  const roleLabel = isAdmin
    ? "Trust administrator"
    : isDirector
      ? "Director of Safeguarding"
      : `DSL${tenancy.schools[0] ? `, ${tenancy.schools[0].name}` : ""}`;

  const api = await serverApi();
  const counts = await api.overview.counts();

  const dslSchoolId = tenancy.schools[0]?.id;
  const schoolBase = dslSchoolId
    ? `/dashboard/school/${dslSchoolId}`
    : "/dashboard";

  // Role-appropriate navigation. A director oversees the trust; a DSL works
  // within their one school. Every item lands on a surface that exists.
  const nav: NavItem[] = isDirector
    ? [
        {
          href: "/dashboard/trust",
          label: "Trust overview",
          icon: LayoutDashboard,
        },
        { href: "/dashboard/schools", label: "Schools", icon: Building2 },
        {
          href: "/dashboard/trust/triage/active",
          label: "Concerns",
          icon: Flag,
          badge: counts.concerns,
          match: "/dashboard/trust/triage",
        },
        { href: "/dashboard/reports", label: "Reports", icon: FileBarChart },
        { href: "/dashboard/insights", label: "Insights", icon: LineChart },
        {
          href: "/dashboard/alerts",
          label: "Alerts",
          icon: Bell,
          badge: counts.alerts,
        },
        {
          href: "/dashboard/governance",
          label: "Governance",
          icon: ShieldCheck,
        },
        { href: "/dashboard/audit", label: "Audit log", icon: ScrollText },
        {
          href: "/dashboard/trust/inspection",
          label: "Inspection",
          icon: SearchCheck,
        },
      ]
    : [
        {
          href: schoolBase,
          label: "Overview",
          icon: LayoutDashboard,
          match: schoolBase,
        },
        {
          href: `${schoolBase}/triage/active`,
          label: "Concerns",
          icon: Flag,
          badge: counts.concerns,
          match: `${schoolBase}/triage`,
        },
        {
          href: `${schoolBase}/documents`,
          label: "Documents",
          icon: FolderOpen,
        },
        {
          href: "/dashboard/alerts",
          label: "Alerts",
          icon: Bell,
          badge: counts.alerts,
        },
        { href: `${schoolBase}/kcsie`, label: "KCSIE", icon: FileText },
        {
          href: `${schoolBase}/inspection`,
          label: "Inspection",
          icon: SearchCheck,
        },
        {
          href: "/dashboard/governance",
          label: "Governance",
          icon: ShieldCheck,
        },
        { href: "/dashboard/audit", label: "Audit log", icon: ScrollText },
      ];

  // Trust administrators get the onboarding and user-management surfaces.
  if (isAdmin) {
    nav.push({
      href: "/dashboard/admin/onboarding",
      label: "Onboarding",
      icon: Rocket,
    });
    nav.push({ href: "/dashboard/admin/users", label: "Users", icon: Users });
    nav.push({
      href: "/dashboard/admin/billing",
      label: "Billing",
      icon: CreditCard,
    });
  }

  const quickActions: QuickAction[] = isDirector
    ? [
        {
          href: "/dashboard/trust/triage/awaiting",
          label: "Review queue",
          icon: Flag,
        },
        { href: "/dashboard/reports", label: "Generate report", icon: FileText },
        {
          href: "/dashboard/insights",
          label: "Explore insights",
          icon: LineChart,
        },
      ]
    : [
        {
          href: `${schoolBase}/triage/awaiting`,
          label: "Review queue",
          icon: Flag,
        },
        {
          href: `${schoolBase}/documents`,
          label: "Read a document",
          icon: FolderOpen,
        },
        { href: "/dashboard/reports", label: "Generate report", icon: FileText },
      ];

  const displayName = session.user.name ?? session.user.email;

  return (
    <div className="flex min-h-screen">
      <Sidebar
        nav={nav}
        quickActions={quickActions}
        name={displayName}
        roleLabel={roleLabel}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar showSwitch={isDirector} alertsCount={counts.alerts} />
        <main className="flex-1">
          <div className="mx-auto w-full max-w-[1200px] px-6 py-8">
            {children}
          </div>
        </main>
        <ShellFooter />
      </div>
    </div>
  );
}
