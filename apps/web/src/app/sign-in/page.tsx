import { Suspense } from "react";

import { SignInForm } from "@/app/sign-in/sign-in-form";

export const metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-6">
      <Suspense>
        <SignInForm />
      </Suspense>
    </main>
  );
}
