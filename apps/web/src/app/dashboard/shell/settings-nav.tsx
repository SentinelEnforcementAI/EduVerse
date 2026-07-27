"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Settings, type LucideIcon } from "lucide-react";

export type SettingsItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  match?: string;
};

// The administrative / configuration surfaces (governance, inspection, and the
// trust-admin tools) tucked behind a single Settings entry, so the primary rail
// stays focused on the safeguarding workflow. Collapsed by default; opens
// automatically when the current screen is one of these.
export function SettingsNav({ items }: { items: SettingsItem[] }) {
  const pathname = usePathname();
  const isActive = (item: SettingsItem) => {
    const base = item.match ?? item.href;
    return pathname === base || pathname.startsWith(`${base}/`);
  };
  const anyActive = items.some(isActive);
  const [open, setOpen] = useState(anyActive);

  return (
    <div className="mt-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Settings className="size-[18px] shrink-0" aria-hidden />
        <span className="flex-1 text-left">Settings</span>
        <ChevronDown
          className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open ? (
        <ul className="mt-0.5 space-y-0.5 pl-3">
          {items.map((item) => {
            const Icon = item.icon;
            const active = isActive(item);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    active
                      ? "bg-cobalt-tint font-medium text-cobalt"
                      : "text-muted-foreground hover:bg-paper hover:text-ink"
                  }`}
                >
                  <Icon className="size-[18px] shrink-0" aria-hidden />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
