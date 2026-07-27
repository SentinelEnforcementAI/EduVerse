import Link from "next/link";
import { HelpCircle, type LucideIcon } from "lucide-react";

import { BrandLockup } from "@/components/brand";

import { NavLink } from "./nav-link";
import { ProfileMenu, type Workspace } from "./profile-menu";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
  // Highlight when the path starts with `match` (defaults to exact href).
  match?: string;
};

export type QuickAction = { href: string; label: string; icon: LucideIcon };

// The primary application shell: a persistent left rail. Navigation, quick
// actions and identity all live here, so the same chrome frames every screen.
// A server component — it renders each icon and hands the element to NavLink,
// the one client piece, which derives active state from the current path.
export function Sidebar({
  nav,
  quickActions,
  name,
  roleLabel,
  trustName,
  schools,
}: {
  nav: NavItem[];
  quickActions: QuickAction[];
  name: string;
  roleLabel: string;
  // Trust name + schools drive the workspace switch in the profile menu.
  // trustName is null for a single-school DSL (no switch shown).
  trustName: string | null;
  schools: Workspace[];
}) {
  const initials =
    name
      .split(/\s+/)
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "SW";

  return (
    <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-cloud bg-card">
      <div className="px-5 py-5">
        <Link
          href="/dashboard"
          className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Sentinel Watch — overview"
        >
          <BrandLockup markVariant="cobalt" />
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3">
        <ul className="space-y-0.5">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <NavLink
                  href={item.href}
                  label={item.label}
                  match={item.match}
                  badge={item.badge}
                >
                  <Icon className="size-[18px] shrink-0" aria-hidden />
                </NavLink>
              </li>
            );
          })}
        </ul>

        <div className="mt-6 rounded-xl border border-cloud p-3">
          <div className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Quick actions
          </div>
          <ul className="mt-2 space-y-0.5">
            {quickActions.map((qa) => {
              const Icon = qa.icon;
              return (
                <li key={qa.href}>
                  <Link
                    href={qa.href}
                    className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm text-ink transition-colors hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="flex size-6 items-center justify-center rounded-md bg-cobalt-tint text-cobalt">
                      <Icon className="size-3.5" aria-hidden />
                    </span>
                    {qa.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        <Link
          href="/dashboard/governance"
          className="mt-4 flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-ink"
        >
          <HelpCircle className="size-[18px]" aria-hidden />
          Help &amp; support
        </Link>
      </nav>

      <ProfileMenu
        name={name}
        roleLabel={roleLabel}
        initials={initials}
        trustName={trustName}
        schools={schools}
      />
    </aside>
  );
}
