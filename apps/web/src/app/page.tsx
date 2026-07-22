import Link from "next/link";

import { BrandLockup } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { getAuthSession } from "@/server/auth/session";

export default async function Home() {
  const session = await getAuthSession();

  // Brand refresh: the product lives on light surfaces throughout — paper,
  // generous space, one cobalt action. Monochrome by default, cobalt with
  // intent. (Lime is never text on light — the kicker is cobalt.)
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-10 px-6 py-16 text-center">
      <div className="flex flex-col items-center gap-6">
        <BrandLockup markVariant="cobalt" className="gap-3" />
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-cobalt">
          Safeguarding intelligence
        </p>
        <h1 className="max-w-2xl text-[2.75rem] font-semibold leading-[1.1] tracking-tight md:text-[3.5rem]">
          See risk sooner.
        </h1>
        <p className="max-w-md text-lg text-muted-foreground">
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
