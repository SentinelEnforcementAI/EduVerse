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
          ? "bg-cobalt-tint text-cobalt"
          : "text-muted-foreground hover:bg-paper hover:text-ink",
      )}
    >
      {children}
      <span className="flex-1 truncate">{label}</span>
      {typeof badge === "number" && badge > 0 ? (
        <span
          className={cn(
            "min-w-5 rounded-full px-1.5 py-0.5 text-center text-xs font-semibold tabular-nums",
            active ? "bg-cobalt text-white" : "bg-cloud text-muted-foreground",
          )}
        >
          {badge}
        </span>
      ) : null}
    </Link>
  );
}
