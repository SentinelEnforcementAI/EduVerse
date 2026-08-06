import Link from "next/link";

// A quiet product footer. The compliance statement (KCSIE / UK GDPR / UK data
// residency) is governance metadata, not per-screen chrome — it lives on the
// Governance page rather than consuming space on every operational view.
export function ShellFooter() {
  return (
    <footer className="border-t border-cloud">
      <div className="mx-auto flex w-full max-w-[1280px] items-center justify-between gap-2.5 px-6 py-4 text-xs text-muted-foreground">
        <span>Sentinel Watch</span>
        <Link
          href="/dashboard/governance"
          className="hover:text-ink hover:underline"
        >
          Governance &amp; compliance
        </Link>
      </div>
    </footer>
  );
}
