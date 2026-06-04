import { ChevronLeft } from "lucide-react";
import { OnboardingBrandPanel } from "../../components/onboarding-brand-panel";
import { PlanCard } from "../../components/plan-card";
import { useOnboardingBillingViewModel } from "./onboarding-billing.view-model";
import { cn } from "../../lib/utils";

const MARKETING_URL = import.meta.env.VITE_MARKETING_URL ?? "https://nudge.com";

export function OnboardingBillingPage() {
  const vm = useOnboardingBillingViewModel();

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

        <div className="flex flex-1 flex-col items-center justify-center py-8">
          <div className="w-full max-w-[960px]">
            <header className="mb-8 text-center">
              <h1 className="text-[28px] font-semibold leading-tight text-[#041534]">
                Choose your plan.
              </h1>
              <p className="mt-2 text-sm text-[#45464E]">
                A payment card is required to start. Cancel anytime.
              </p>
            </header>

            {vm.showCancelledBanner && (
              <div className="mb-6 rounded-md border border-[#C5C6CF] bg-[#F9F9F9] px-4 py-3 text-center text-sm text-[#45464E]">
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

            <p className="mt-6 text-center text-xs text-[#6B7280]">
              You'll be redirected to Stripe to enter your card. Then we'll bring
              you back to finish setup.
            </p>
            <p className={cn("mt-1 text-center text-xs text-[#6B7280]")}>
              Need something custom?{" "}
              <a href={`mailto:support@nudge.com`} className="font-semibold text-[#2E75B6]">
                Contact support
              </a>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
