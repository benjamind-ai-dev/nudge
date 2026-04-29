import { useBillingViewModel } from "./billing.view-model";
import type { BillingPlan } from "../../api/billing.api";

const PLANS: { id: BillingPlan; label: string; description: string }[] = [
  { id: "starter", label: "Starter", description: "For small teams" },
  { id: "growth", label: "Growth", description: "For growing businesses" },
  { id: "agency", label: "Agency", description: "For agencies & power users" },
];

export function BillingPage() {
  const vm = useBillingViewModel();

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Billing</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your subscription and billing details.
        </p>
      </div>

      {vm.redirectStatus === "success" && (
        <div className="rounded-md bg-green-50 border border-green-200 p-4 text-sm text-green-800">
          Subscription activated successfully.
        </div>
      )}
      {vm.redirectStatus === "cancelled" && (
        <div className="rounded-md bg-yellow-50 border border-yellow-200 p-4 text-sm text-yellow-800">
          Checkout cancelled. No changes were made.
        </div>
      )}

      {vm.isLoading ? (
        <div className="text-sm text-muted-foreground">Loading billing status…</div>
      ) : (
        <>
          <div className="rounded-lg border p-5 space-y-1">
            <p className="text-sm font-medium">Current plan</p>
            <p className="text-2xl font-bold capitalize">
              {vm.status?.plan ?? "No active plan"}
            </p>
            <p className="text-sm text-muted-foreground capitalize">
              Status: {vm.status?.status ?? "—"}
            </p>
            {vm.status?.trial_ends_at && vm.status.status === "trial" && (
              <p className="text-sm text-muted-foreground">
                Trial ends:{" "}
                {new Date(vm.status.trial_ends_at).toLocaleDateString()}
              </p>
            )}
            {vm.status?.current_period_end && (
              <p className="text-sm text-muted-foreground">
                {vm.status.cancel_at_period_end
                  ? "Cancels on: "
                  : "Renews on: "}
                {new Date(vm.status.current_period_end).toLocaleDateString()}
              </p>
            )}
          </div>

          <div>
            <p className="text-sm font-medium mb-3">
              {vm.hasActiveSubscription ? "Change plan" : "Choose a plan"}
            </p>
            <div className="grid grid-cols-3 gap-4">
              {PLANS.map((plan) => (
                <button
                  key={plan.id}
                  onClick={() => vm.handleCheckout(plan.id)}
                  disabled={vm.isCheckingOut || vm.currentPlanId === plan.id}
                  className="rounded-lg border p-4 text-left hover:border-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <p className="font-semibold">{plan.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {plan.description}
                  </p>
                  {vm.currentPlanId === plan.id && (
                    <p className="text-xs text-primary mt-2 font-medium">
                      Current plan
                    </p>
                  )}
                </button>
              ))}
            </div>
            {vm.isCheckingOut && (
              <p className="text-xs text-muted-foreground mt-2">
                Redirecting to checkout…
              </p>
            )}
          </div>

          {vm.hasActiveSubscription && (
            <div className="border-t pt-6">
              <p className="text-sm font-medium mb-1">Manage subscription</p>
              <p className="text-xs text-muted-foreground mb-3">
                Update payment method, view invoices, or cancel your subscription
                via the Stripe billing portal.
              </p>
              <button
                onClick={vm.handlePortal}
                disabled={vm.isOpeningPortal}
                className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50"
              >
                {vm.isOpeningPortal ? "Opening portal…" : "Manage Billing"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
