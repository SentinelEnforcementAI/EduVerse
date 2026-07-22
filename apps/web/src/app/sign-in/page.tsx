import { Suspense } from "react";

import { SignInForm } from "@/app/sign-in/sign-in-form";
import { BrandLockup } from "@/components/brand";

export const metadata = { title: "Sign in" };

// Brand refresh: the whole product stays light — auth included. Dark ink
// is reserved for the app icon and marketing decks.
export default function SignInPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-12">
      <BrandLockup markVariant="cobalt" />
      <Suspense>
        <SignInForm />
      </Suspense>
    </main>
  );
}
