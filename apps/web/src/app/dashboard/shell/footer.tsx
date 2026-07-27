import { ShieldCheck } from "lucide-react";

// The product's assurance line, on every view (spec section 4). These three
// commitments are load-bearing, not decoration: KCSIE alignment, UK GDPR, and
// UK-only data residency (CLAUDE.md principle 2).
export function ShellFooter() {
  return (
    <footer className="border-t border-cloud">
      <div className="mx-auto flex w-full max-w-[1280px] items-center gap-2.5 px-6 py-6 text-xs text-muted-foreground">
        <ShieldCheck className="size-4 text-cobalt" aria-hidden />
        <span>
          KCSIE 2026 aligned&nbsp;&nbsp;·&nbsp;&nbsp;UK GDPR&nbsp;&nbsp;·&nbsp;&nbsp;Data
          residency: UK
        </span>
      </div>
    </footer>
  );
}
