import { Suspense } from "react";
import Link from "next/link";
import { Bell, PhoneCall, ShieldCheck } from "lucide-react";

import { SearchBox } from "./search-box";

// The top bar sits above every page inside the shell: a couple of always-on
// links on the left, a global search affordance in the middle, and the alerts
// bell on the right. Search is presentational for now (the sealed pupil
// directory it will query lands with its own slice); it is a real, focusable
// control so the shell feels complete.
export function Topbar({
  showSwitch,
  alertsCount,
}: {
  showSwitch: boolean;
  alertsCount: number;
}) {
  return (
    <header className="sticky top-0 z-10 border-b border-cloud bg-card/80 backdrop-blur">
      <div className="flex items-center gap-4 px-6 py-3">
        <nav className="flex items-center gap-1">
          <Link
            href="/dashboard/oncall"
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-paper hover:text-ink"
          >
            <PhoneCall className="size-4" aria-hidden />
            On-call
          </Link>
          <Link
            href="/dashboard/governance"
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-paper hover:text-ink"
          >
            <ShieldCheck className="size-4" aria-hidden />
            Governance
          </Link>
          {showSwitch ? (
            <Link
              href="/dashboard/trust"
              className="rounded-md px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-paper hover:text-ink"
            >
              Trust view
            </Link>
          ) : null}
        </nav>

        <Suspense
          fallback={<div className="mx-auto h-9 w-full max-w-md" />}
        >
          <SearchBox />
        </Suspense>

        <Link
          href="/dashboard/alerts"
          aria-label={`Alerts${alertsCount ? `, ${alertsCount} needing attention` : ""}`}
          className="relative flex size-9 items-center justify-center rounded-lg border border-cloud text-muted-foreground transition-colors hover:border-ink hover:text-ink"
        >
          <Bell className="size-[18px]" aria-hidden />
          {alertsCount > 0 ? (
            <span className="absolute -right-1.5 -top-1.5 flex min-w-[18px] items-center justify-center rounded-full bg-risk px-1 py-0.5 text-[11px] font-semibold leading-none text-white">
              {alertsCount}
            </span>
          ) : null}
        </Link>
      </div>
    </header>
  );
}
