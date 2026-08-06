"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

// One sidebar nav row. Active state is the only thing that needs the client
// (the current path), so this is the sole client component in the rail; the
// icon arrives already rendered as children, which is serializable across the
// server/client boundary (a component function would not be).
export function NavLink({
  href,
  label,
  match,
  badge,
  children,
}: {
  href: string;
  label: string;
  match?: string;
  badge?: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const base = match ?? href;
  const active =
    base === "/dashboard"
      ? pathname === base
      : pathname === base || pathname.startsWith(`${base}/`);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "bg-cobalt-tint/70 text-cobalt"
          : "text-muted-foreground hover:bg-paper hover:text-ink",
      )}
    >
      {children}
      <span className="flex-1 truncate">{label}</span>
      {typeof badge === "number" && badge > 0 ? (
        // A small, neutral count — cobalt is reserved for interaction, not for
        // decorating every badge.
        <span className="min-w-[18px] rounded-full bg-cloud px-1 py-px text-center text-[11px] font-semibold leading-4 tabular-nums text-ink-muted">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}
