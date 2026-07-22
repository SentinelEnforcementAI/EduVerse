import { Suspense } from "react";

import { SignInForm } from "@/app/sign-in/sign-in-form";
import { BrandLockup } from "@/components/brand";

export const metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6">
      <BrandLockup markVariant="cobalt" />
      <Suspense>
        <SignInForm />
      </Suspense>
    </main>
  );
}
