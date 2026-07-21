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
              <span className="font-medium text-green-700 dark:text-green-400">
                {ping.data.status}
              </span>
            </span>
            <span className="text-muted-foreground">
              Checked at {ping.data.time.toLocaleTimeString("en-GB")}
            </span>
          </div>
        ) : (
          <span className="text-destructive">API unreachable</span>
        )}
      </CardContent>
    </Card>
  );
}
