"use client";

import { useRouter } from "next/navigation";
import { ClipboardList, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { api } from "@/trpc/react";

// Generate the section 175 pre-fill or the governor compliance pack, filed to
// the vault, then open it (spec 5.12).
export function KcsieActions({ schoolId }: { schoolId: string }) {
  const router = useRouter();
  const s175 = api.kcsie.section175.useMutation({
    onSuccess: (r) =>
      router.push(`/dashboard/school/${schoolId}/documents/${r.id}`),
  });
  const pack = api.kcsie.compliancePack.useMutation({
    onSuccess: (r) =>
      router.push(`/dashboard/school/${schoolId}/documents/${r.id}`),
  });

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="secondary"
        size="sm"
        disabled={s175.isPending}
        onClick={() => s175.mutate({ schoolId })}
      >
        <FileText className="size-4" aria-hidden />
        {s175.isPending ? "Pre-filling…" : "Pre-fill section 175"}
      </Button>
      <Button
        variant="secondary"
        size="sm"
        disabled={pack.isPending}
        onClick={() => pack.mutate({ schoolId })}
      >
        <ClipboardList className="size-4" aria-hidden />
        {pack.isPending ? "Assembling…" : "Governor pack"}
      </Button>
    </div>
  );
}

// Compliance status tag. Monochrome and cobalt only: the red/amber/green risk
// palette is reserved for risk about a child (DESIGN.md v2), and compliance is
// not that.
export function ComplianceTag({ status }: { status: string }) {
  const styles: Record<string, string> = {
    ok: "bg-cobalt-tint text-cobalt",
    due: "border border-cloud text-ink-muted",
    gap: "bg-ink text-white",
  };
  const label: Record<string, string> = {
    ok: "Up to date",
    due: "Action due",
    gap: "Gap",
  };
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles[status] ?? ""}`}
    >
      {label[status] ?? status}
    </span>
  );
}
