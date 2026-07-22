"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api } from "@/trpc/react";

// Exercises the example tRPC route end to end from the browser.
export function SystemStatus() {
  const ping = api.health.ping.useQuery({ echo: "dashboard" });

  return (
    <Card>
      <CardHeader>
        <CardTitle>System status</CardTitle>
        <CardDescription>Live check against the API.</CardDescription>
      </CardHeader>
      <CardContent className="text-sm">
        {ping.isLoading ? (
          <span className="text-muted-foreground">Checking…</span>
        ) : ping.data ? (
          <div className="flex flex-col gap-1">
            <span>
              API:{" "}
              <span className="font-bold text-forest">{ping.data.status}</span>
            </span>
            <span className="tabular-nums text-muted-foreground">
              Checked at {ping.data.time.toLocaleTimeString("en-GB")}
            </span>
          </div>
        ) : (
          <span className="font-bold">API unreachable</span>
        )}
      </CardContent>
    </Card>
  );
}
