"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// Segment-level error boundary for every dashboard screen. A rendering or data
// failure on one screen degrades to this graceful fallback inside the shell
// (the sidebar stays), instead of a raw server error. The underlying error is
// still logged server-side by the framework and correlated by `digest`, so it
// remains diagnosable — this only changes what a person sees, never hides the
// fault from the logs.
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface it to the browser console too, so a live session shows the
    // reference. The server log carries the full stack under the same digest.
    console.error("dashboard screen error", error.digest, error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center py-16 text-center">
      <Card className="w-full p-8">
        <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-warning-tint text-warning">
          <AlertTriangle className="size-6" aria-hidden />
        </div>
        <h1 className="mt-5 text-xl font-semibold">This screen could not load</h1>
        <p className="mt-2 text-base text-muted-foreground">
          Something went wrong preparing this view. Your data is safe and nothing
          has been changed. Try again, or return to the dashboard.
        </p>
        {error.digest ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Reference: <span className="font-mono">{error.digest}</span>
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button size="sm" onClick={() => reset()}>
            <RotateCw className="size-4" aria-hidden />
            Try again
          </Button>
          <Button variant="secondary" size="sm" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="size-4" aria-hidden />
              Back to dashboard
            </Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
