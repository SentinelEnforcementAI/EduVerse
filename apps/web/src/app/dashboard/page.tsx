import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Building2, GraduationCap } from "lucide-react";

import { Card } from "@/components/ui/card";
import { serverApi } from "@/trpc/server";

// Entry (spec section 4). A DSL has one school, so they land straight on it. A
// director chooses how to work: across the whole trust, or stepping into one
// school. Both tenancy modes are reachable here for a user who has both.
export default async function DashboardHome() {
  const api = await serverApi();
  const tenancy = await api.overview.tenancy();

  if (tenancy.mode === "school") {
    const school = tenancy.schools[0];
    if (school) {
      redirect(`/dashboard/school/${school.id}`);
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center py-10 text-center">
      <p className="text-lg font-medium italic text-cobalt">
        Every child. Seen. Safe. Supported.
      </p>
      <p className="mt-3 max-w-md text-base text-muted-foreground">
        Choose how to work. Both paths use the same intelligence layer over your
        existing systems.
      </p>

      <div className="mt-10 grid w-full gap-5 sm:grid-cols-2">
        <Link
          href="/dashboard/trust"
          className="group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Card className="h-full p-8 text-left transition-colors group-hover:border-cobalt">
            <div className="flex size-12 items-center justify-center rounded-lg bg-cobalt-tint">
              <Building2 className="size-6 text-cobalt" aria-hidden />
            </div>
            <div className="mt-5 text-xl font-semibold">Multi-Academy Trust</div>
            <p className="mt-2 text-base text-muted-foreground">
              Trust-wide oversight, school-level status, and drill-down into any
              school.
            </p>
            <div className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-cobalt">
              Open trust overview
              <ArrowRight className="size-4" aria-hidden />
            </div>
          </Card>
        </Link>

        <Card className="h-full p-8 text-left">
          <div className="flex size-12 items-center justify-center rounded-lg bg-cobalt-tint">
            <GraduationCap className="size-6 text-cobalt" aria-hidden />
          </div>
          <div className="mt-5 text-xl font-semibold">Single school</div>
          <p className="mt-2 text-base text-muted-foreground">
            Step into one school&apos;s safeguarding overview.
          </p>
          <ul className="mt-4 flex flex-col gap-2">
            {tenancy.schools.map((school) => (
              <li key={school.id}>
                <Link
                  href={`/dashboard/school/${school.id}`}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-cobalt hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {school.name}
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
