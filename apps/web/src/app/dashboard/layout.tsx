import { redirect } from "next/navigation";
import {
  Bell,
  Building2,
  CreditCard,
  FileBarChart,
  FileText,
  Flag,
  FolderOpen,
  Inbox,
  LayoutDashboard,
  LineChart,
  Rocket,
  ScrollText,
  SearchCheck,
  ShieldCheck,
  SlidersHorizontal,
  Users,
} from "lucide-react";

import { resolveTenancy, systemDb } from "@sentinel/db";

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
  // Pending inbound-mail intake awaiting a DSL (phase 2). Only meaningful for a
  // single-school DSL view; a director triages within a school.
  const intakeCount =
    !isDirector && dslSchoolId
      ? await api.intake.count({ schoolId: dslSchoolId })
      : 0;
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
        { href: "/dashboard/audit", label: "Audit log", icon: ScrollText },
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
          href: `${schoolBase}/intake`,
          label: "Intake",
          icon: Inbox,
          badge: intakeCount,
        },
        {
          href: "/dashboard/alerts",
          label: "Alerts",
          icon: Bell,
          badge: counts.alerts,
        },
        { href: `${schoolBase}/kcsie`, label: "KCSIE", icon: FileText },
        { href: "/dashboard/audit", label: "Audit log", icon: ScrollText },
      ];

  // Configuration and assurance surfaces live behind a single Settings entry,
  // not on the primary rail: governance and inspection for everyone, plus the
  // trust-admin tools (onboarding, users, rules, billing) for an administrator.
  const settings: NavItem[] = [
    { href: "/dashboard/governance", label: "Governance", icon: ShieldCheck },
    isDirector
      ? {
          href: "/dashboard/trust/inspection",
          label: "Inspection",
          icon: SearchCheck,
        }
      : {
          href: `${schoolBase}/inspection`,
          label: "Inspection",
          icon: SearchCheck,
        },
  ];
  if (isAdmin) {
    settings.push(
      {
        href: "/dashboard/admin/onboarding",
        label: "Onboarding",
        icon: Rocket,
      },
      { href: "/dashboard/admin/users", label: "Users", icon: Users },
      {
        href: "/dashboard/admin/rules",
        label: "Rules",
        icon: SlidersHorizontal,
      },
      { href: "/dashboard/admin/billing", label: "Billing", icon: CreditCard },
    );
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

  // A director / trust admin can switch between the whole-trust (MAT) view and
  // any single school; a DSL has just their own school (no switch shown).
  const trust =
    isDirector && tenancy.trustId
      ? await systemDb.trust.findUnique({
          where: { id: tenancy.trustId },
          select: { name: true },
        })
      : null;
  const workspaceSchools = tenancy.schools.map((s) => ({
    id: s.id,
    name: s.name,
  }));

  return (
    <div className="flex min-h-screen">
      <Sidebar
        nav={nav}
        settings={settings}
        quickActions={quickActions}
        name={displayName}
        roleLabel={roleLabel}
        trustName={trust?.name ?? null}
        schools={workspaceSchools}
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
