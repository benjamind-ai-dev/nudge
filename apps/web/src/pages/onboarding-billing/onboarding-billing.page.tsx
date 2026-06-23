import { OnboardingBrandPanel } from "../../components/onboarding-brand-panel";
import { BackToMarketingLink } from "../../components/back-to-marketing-link";
import { PlanCard } from "../../components/plan-card";
import { useOnboardingBillingViewModel } from "./onboarding-billing.view-model";
import { cn } from "../../lib/utils";

export function OnboardingBillingPage() {
  const vm = useOnboardingBillingViewModel();

  return (
    <div className="flex min-h-screen bg-white">
      <OnboardingBrandPanel />

      <main className="flex flex-1 flex-col px-6 py-8 md:px-12">
        <BackToMarketingLink />

        <div className="flex flex-1 flex-col items-center justify-center py-8">
          <div className="w-full max-w-[960px]">
            <header className="mb-8 text-center">
              <h1 className="text-[28px] font-semibold leading-tight text-[#041534]">
                Choose your plan.
              </h1>
              <p className="mt-2 text-sm text-[#64748B]">
                A payment card is required to start. Cancel anytime.
              </p>
            </header>

            {vm.showCancelledBanner && (
              <div className="mb-6 rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-center text-sm text-[#64748B]">
                No payment was taken. Pick a plan when you're ready.
              </div>
            )}

            {vm.error && (
              <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-center text-sm text-red-700">
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

            <p className="mt-6 text-center text-xs text-[#64748B]">
              You'll be redirected to Stripe to enter your card. Then we'll bring
              you back to finish setup.
            </p>
            <p className={cn("mt-1 text-center text-xs text-[#64748B]")}>
              Need something custom?{" "}
              <a href={`mailto:support@nudge.com`} className="font-semibold text-[#2563EB]">
                Contact support
              </a>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
