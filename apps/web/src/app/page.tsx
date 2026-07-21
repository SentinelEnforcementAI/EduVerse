import Link from "next/link";

import { Button } from "@/components/ui/button";
import { getAuthSession } from "@/server/auth/session";

export default async function Home() {
  const session = await getAuthSession();

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 text-center">
      <div className="flex flex-col items-center gap-4">
        <h1 className="font-serif text-2xl font-bold tracking-tight">
          Sentinel Watch
        </h1>
        <p className="max-w-md text-base text-muted-foreground">
          Safeguarding intelligence for UK schools and Multi-Academy Trusts.
          Signals for Designated Safeguarding Leads — the system flags, humans
          decide.
        </p>
      </div>
      <Button asChild size="lg">
        {session ? (
          <Link href="/dashboard">Go to dashboard</Link>
        ) : (
          <Link href="/sign-in">Sign in</Link>
        )}
      </Button>
    </main>
  );
}
