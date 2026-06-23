import { SignUp } from "@clerk/clerk-react";
import { OnboardingBrandPanel } from "../components/onboarding-brand-panel";
import { BackToMarketingLink } from "../components/back-to-marketing-link";
import { clerkAppearance } from "../lib/clerk-appearance";

export function SignUpPage() {
  return (
    <div className="flex min-h-screen bg-background">
      <OnboardingBrandPanel />

      <main className="flex flex-1 flex-col px-6 py-8 md:px-12">
        <BackToMarketingLink />

        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-[400px]">
            <h1 className="text-[28px] leading-tight text-foreground">
              Get started in 60 seconds.
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Connect your books. We handle the follow-ups.
            </p>

            <div className="mt-8">
              <SignUp
                routing="path"
                path="/sign-up"
                signInUrl="/sign-in"
                fallbackRedirectUrl="/onboarding"
                appearance={clerkAppearance}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
