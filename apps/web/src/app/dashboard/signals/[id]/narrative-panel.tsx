"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { api } from "@/trpc/react";

export function GenerateNarrativeButton({
  signalId,
  hasNarrative,
}: {
  signalId: string;
  hasNarrative: boolean;
}) {
  const router = useRouter();
  const generate = api.signals.generateNarrative.useMutation({
    onSuccess: () => router.refresh(),
  });

  return (
    <div className="flex flex-col gap-2">
      <Button
        onClick={() => generate.mutate({ signalId })}
        disabled={generate.isPending}
        variant="outline"
        size="sm"
        className="self-start"
      >
        {generate.isPending
          ? "Generating…"
          : hasNarrative
            ? "Regenerate summary"
            : "Generate AI summary"}
      </Button>
      {generate.error ? (
        <p className="text-sm text-destructive">{generate.error.message}</p>
      ) : null}
    </div>
  );
}
