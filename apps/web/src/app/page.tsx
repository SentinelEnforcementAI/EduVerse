import Link from "next/link";

import { BrandLockup } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { getAuthSession } from "@/server/auth/session";

export default async function Home() {
  const session = await getAuthSession();

  // Marketing moment: ink surface, lime kicker (accent only — never risk
  // meaning), cobalt for the one action (DESIGN.md v2).
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 bg-ink px-6 py-12 text-center text-white">
      <div className="flex flex-col items-center gap-5">
        <BrandLockup
          markVariant="cobalt"
          wordmarkClassName="text-white"
          className="gap-3"
        />
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-signal-lime">
          Safeguarding intelligence
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          See risk sooner.
        </h1>
        <p className="max-w-md text-base text-white/70">
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
