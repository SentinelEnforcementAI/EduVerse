import { Suspense } from "react";

import { SignInForm } from "@/app/sign-in/sign-in-form";
import { BrandLockup } from "@/components/brand";

export const metadata = { title: "Sign in" };

// Dark surfaces are reserved for auth screens, app-icon contexts and
// marketing (DESIGN.md v2) — the working app stays light.
export default function SignInPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 bg-ink px-6 py-12">
      <BrandLockup markVariant="cobalt" wordmarkClassName="text-white" />
      <Suspense>
        <SignInForm />
      </Suspense>
    </main>
  );
}
