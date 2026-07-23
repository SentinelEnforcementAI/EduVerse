"use client";

import { useRouter } from "next/navigation";
import { FileStack } from "lucide-react";

import { Button } from "@/components/ui/button";
import { api } from "@/trpc/react";

// Assemble an inspection evidence pack from the vault, filed back as a
// generated document (spec 5.9). Navigates to the new pack on success.
export function EvidencePackButton({ schoolId }: { schoolId: string }) {
  const router = useRouter();
  const pack = api.documents.evidencePack.useMutation({
    onSuccess: (r) => {
      router.push(`/dashboard/school/${schoolId}/documents/${r.id}`);
    },
  });

  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={pack.isPending}
      onClick={() => pack.mutate({ schoolId })}
    >
      <FileStack className="size-4" aria-hidden />
      {pack.isPending ? "Assembling…" : "Evidence pack"}
    </Button>
  );
}
