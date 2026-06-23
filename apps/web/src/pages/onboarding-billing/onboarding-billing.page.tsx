import { OnboardingBrandPanel } from "../../components/onboarding-brand-panel";
import { BackToMarketingLink } from "../../components/back-to-marketing-link";
import { PlanCard } from "../../components/plan-card";
import { useOnboardingBillingViewModel } from "./onboarding-billing.view-model";

export function OnboardingBillingPage() {
  const vm = useOnboardingBillingViewModel();

  return (
    <div className="flex min-h-screen bg-background">
      <OnboardingBrandPanel />

      <main className="flex flex-1 flex-col px-6 py-8 md:px-12">
        <BackToMarketingLink />

        <div className="flex flex-1 flex-col items-center justify-center py-8">
          <div className="w-full max-w-[960px]">
            <header className="mb-8 text-center">
              <h1 className="text-[28px] font-semibold leading-tight text-foreground">
                Choose your plan.
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                A payment card is required to start. Cancel anytime.
              </p>
            </header>

            {vm.showCancelledBanner && (
              <div className="mb-6 rounded-md border border-border bg-muted px-4 py-3 text-center text-sm text-muted-foreground">
                No payment was taken. Pick a plan when you're ready.
              </div>
            )}

            {vm.error && (
              <div className="mb-6 rounded-md border border-destructive/20 bg-destructive/5 px-4 py-3 text-center text-sm text-destructive">
                {vm.error}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {vm.plans.map((plan) => (
                <PlanCard
                  key={plan.plan}
                  data={{
                    ...plan,
                    featured: plan.featured || vm.preselectedPlan === plan.plan,
                  }}
                  selected={vm.pendingPlan === plan.plan}
                  isLoading={vm.isRedirecting}
                  disabled={vm.isRedirecting}
                  onChoose={vm.handleChoose}
                />
              ))}
            </div>

            <p className="mt-6 text-center text-xs text-muted-foreground">
              You'll be redirected to Stripe to enter your card. Then we'll bring
              you back to finish setup.
            </p>
            <p className="mt-1 text-center text-xs text-muted-foreground">
              Need something custom?{" "}
              <a href="mailto:support@nudge.com" className="font-semibold text-primary hover:underline">
                Contact support
              </a>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
