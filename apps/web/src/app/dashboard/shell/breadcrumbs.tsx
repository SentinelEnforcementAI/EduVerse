import Link from "next/link";
import { ChevronRight } from "lucide-react";

export type Crumb = { label: string; href?: string };

// Breadcrumbs on every view below overview (spec section 4). Each segment with
// an href is navigable; the last (current view) is plain text.
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="mb-4 flex flex-wrap items-center gap-1 text-sm text-muted-foreground"
    >
      {items.map((item, i) => (
        <span key={i} className="inline-flex items-center gap-1">
          {item.href ? (
            <Link
              href={item.href}
              className="text-cobalt hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-ink">{item.label}</span>
          )}
          {i < items.length - 1 ? (
            <ChevronRight className="size-3.5 text-muted-foreground" aria-hidden />
          ) : null}
        </span>
      ))}
    </nav>
  );
}
