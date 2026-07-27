"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  Check,
  ChevronsUpDown,
  LogOut,
  School,
} from "lucide-react";

export type Workspace = { id: string; name: string };

// The account control at the foot of the sidebar. Previously this was a bare
// sign-out submit button behind a chevron — a single click signed the user
// out. It is now a proper menu: identity, a workspace switch (trust ⇆ each
// school, for a director or trust admin), and sign-out as an explicit choice.
export function ProfileMenu({
  name,
  roleLabel,
  initials,
  trustName,
  schools,
}: {
  name: string;
  roleLabel: string;
  initials: string;
  // Present only when the user works across the trust (director / admin);
  // null for a single-school DSL, whose menu is just their identity + sign-out.
  trustName: string | null;
  schools: Workspace[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const canSwitch = trustName !== null;

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const onTrust = pathname === "/dashboard/trust";
  const activeSchoolId = schools.find((s) =>
    pathname.startsWith(`/dashboard/school/${s.id}`),
  )?.id;

  return (
    <div ref={ref} className="relative border-t border-cloud p-3">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-cobalt-tint text-sm font-semibold text-cobalt"
        >
          {initials}
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-sm font-medium">{name}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {roleLabel}
          </span>
        </span>
        <ChevronsUpDown
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute bottom-[calc(100%-0.25rem)] left-3 right-3 z-20 overflow-hidden rounded-xl border border-cloud bg-card shadow-lg"
        >
          {canSwitch ? (
            <div className="border-b border-cloud py-1.5">
              <p className="px-3 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Switch view
              </p>
              <MenuLink
                href="/dashboard/trust"
                active={onTrust}
                onNavigate={() => setOpen(false)}
                icon={<Building2 className="size-4" aria-hidden />}
                label={trustName ?? "Trust overview"}
                sub="Whole trust (MAT)"
              />
              {schools.map((s) => (
                <MenuLink
                  key={s.id}
                  href={`/dashboard/school/${s.id}`}
                  active={s.id === activeSchoolId}
                  onNavigate={() => setOpen(false)}
                  icon={<School className="size-4" aria-hidden />}
                  label={s.name}
                />
              ))}
            </div>
          ) : null}

          <form action="/api/auth/sign-out" method="post" className="p-1.5">
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-ink transition-colors hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <LogOut className="size-4 text-muted-foreground" aria-hidden />
              Sign out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function MenuLink({
  href,
  active,
  onNavigate,
  icon,
  label,
  sub,
}: {
  href: string;
  active: boolean;
  onNavigate: () => void;
  icon: React.ReactNode;
  label: string;
  sub?: string;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onNavigate}
      className="mx-1.5 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors hover:bg-paper"
    >
      <span className="text-muted-foreground">{icon}</span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate font-medium text-ink">{label}</span>
        {sub ? (
          <span className="block truncate text-xs text-muted-foreground">
            {sub}
          </span>
        ) : null}
      </span>
      {active ? (
        <Check className="size-4 shrink-0 text-cobalt" aria-hidden />
      ) : null}
    </Link>
  );
}
