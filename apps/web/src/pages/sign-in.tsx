import { SignIn } from "@clerk/clerk-react";
import { ChevronLeft } from "lucide-react";
import { OnboardingBrandPanel } from "../components/onboarding-brand-panel";
import { clerkAppearance } from "../lib/clerk-appearance";

const MARKETING_URL = import.meta.env.VITE_MARKETING_URL ?? "https://nudge.com";

export function SignInPage() {
  return (
    <div className="flex min-h-screen bg-white">
      <OnboardingBrandPanel />

      <main className="flex flex-1 flex-col px-6 py-8 md:px-12">
        <a
          href={MARKETING_URL}
          className="inline-flex items-center gap-1.5 text-[13px] text-[#45464E] transition-colors hover:text-[#1A1C1C]"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back to nudge.com
        </a>

        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-[400px]">
            <h1 className="text-[28px] leading-tight text-[#041534]">
              Welcome back.
            </h1>
            <p className="mt-2 text-sm text-[#45464E]">
              Sign in to your Nudge account.
            </p>

            <div className="mt-8">
              <SignIn
                routing="path"
                path="/sign-in"
                signUpUrl="/sign-up"
                fallbackRedirectUrl="/dashboard"
                appearance={clerkAppearance}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
