import { SignIn } from "@clerk/clerk-react";
import { OnboardingBrandPanel } from "../components/onboarding-brand-panel";
import { BackToMarketingLink } from "../components/back-to-marketing-link";
import { clerkAppearance } from "../lib/clerk-appearance";

export function SignInPage() {
  return (
    <div className="flex min-h-screen bg-white">
      <OnboardingBrandPanel />

      <main className="flex flex-1 flex-col px-6 py-8 md:px-12">
        <BackToMarketingLink />

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
