import Link from "next/link";
import { ChevronDown } from "lucide-react";

import { BrandLockup } from "@/components/brand";
import { Button } from "@/components/ui/button";

export type HeaderLink = { href: string; label: string };

// The application header (spec section 4): wordmark returns to overview; a
// right-hand cluster of the views available to this user, a switch back to the
// entry, then the user's identity and sign-out. Only views that exist are
// rendered — no dead affordances. The demo's Inspection / Documents / On-call /
// Governance land as their slices are built.
export function ShellHeader({
  name,
  roleLabel,
  links,
  showSwitch,
}: {
  name: string;
  roleLabel: string;
  links: HeaderLink[];
  showSwitch: boolean;
}) {
  return (
    <header className="border-b border-cloud">
      <div className="mx-auto flex w-full max-w-[1280px] flex-wrap items-center justify-between gap-4 px-6 py-4">
        <Link
          href="/dashboard"
          className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Sentinel Watch — overview"
        >
          <BrandLockup markVariant="cobalt" />
        </Link>

        <div className="flex flex-wrap items-center justify-end gap-3">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-paper hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {link.label}
            </Link>
          ))}

          {showSwitch ? (
            <Link
              href="/dashboard"
              className="rounded-md border border-cloud px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-ink hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Switch view
            </Link>
          ) : null}

          <div className="flex items-center gap-2 pl-1">
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-medium">{name}</span>
              <span className="text-xs text-muted-foreground">{roleLabel}</span>
            </div>
            <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
          </div>

          <form action="/api/auth/sign-out" method="post">
            <Button type="submit" variant="secondary" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
