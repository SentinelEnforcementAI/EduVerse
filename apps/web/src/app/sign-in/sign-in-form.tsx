"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/trpc/react";

export function SignInForm() {
  const [email, setEmail] = useState("");
  const searchParams = useSearchParams();
  const linkError = searchParams.get("error") === "invalid_link";

  const requestMagicLink = api.auth.requestMagicLink.useMutation();

  if (requestMagicLink.isSuccess) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Check your email</CardTitle>
          <CardDescription>
            If your address is registered, a sign-in link is on its way to{" "}
            <span className="font-bold text-foreground">{email}</span>. The
            link works once and expires in 15 minutes.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Running locally? The link is printed in the terminal where{" "}
          <code className="font-mono">pnpm dev</code> is running.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Sign in to Sentinel Watch</CardTitle>
        <CardDescription>
          Enter your school email address and we&apos;ll send you a one-time
          sign-in link. No passwords.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            requestMagicLink.mutate({ email });
          }}
        >
          {linkError ? (
            <p className="rounded-md border-l-2 border-forest bg-muted px-3 py-2 text-sm">
              That sign-in link is invalid or has expired. Request a new one
              below.
            </p>
          ) : null}
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@school.org.uk"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          {requestMagicLink.error ? (
            <p className="text-sm font-bold">
              {requestMagicLink.error.data?.zodError?.fieldErrors.email?.[0] ??
                "Something went wrong. Please try again."}
            </p>
          ) : null}
          <Button type="submit" disabled={requestMagicLink.isPending}>
            {requestMagicLink.isPending ? "Sending…" : "Email me a sign-in link"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
