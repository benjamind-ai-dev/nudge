import { useBillingViewModel } from "./billing.view-model";
import type { BillingPlan } from "../../api/billing.api";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";

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
        <h1 className="text-2xl font-semibold text-foreground">Billing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your subscription and billing details.
        </p>
      </div>

      {vm.redirectStatus === "success" && (
        <div className="rounded-md border border-success/20 bg-success/5 p-4 text-sm text-success">
          Subscription activated successfully.
        </div>
      )}
      {vm.redirectStatus === "cancelled" && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Checkout cancelled. No changes were made.
        </div>
      )}

      {vm.isLoading ? (
        <div className="text-sm text-muted-foreground">Loading billing status…</div>
      ) : (
        <>
          <Card className="gap-1 rounded-lg px-5 py-5">
            <CardContent className="px-0 py-0 space-y-1">
              <p className="text-sm font-medium text-foreground">Current plan</p>
              <p className="text-2xl font-bold capitalize text-foreground">
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
            </CardContent>
          </Card>

          <div>
            <p className="mb-3 text-sm font-medium text-foreground">
              {vm.hasActiveSubscription ? "Change plan" : "Choose a plan"}
            </p>
            <div className="grid grid-cols-3 gap-4">
              {PLANS.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => vm.handleCheckout(plan.id)}
                  disabled={vm.isCheckingOut || vm.currentPlanId === plan.id}
                  className="rounded-lg border border-border bg-card p-4 text-left transition-colors hover:border-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <p className="font-semibold text-foreground">{plan.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {plan.description}
                  </p>
                  {vm.currentPlanId === plan.id && (
                    <p className="mt-2 text-xs font-medium text-primary">
                      Current plan
                    </p>
                  )}
                </button>
              ))}
            </div>
            {vm.isCheckingOut && (
              <p className="mt-2 text-xs text-muted-foreground">
                Redirecting to checkout…
              </p>
            )}
          </div>

          {vm.hasActiveSubscription && (
            <div className="border-t border-border pt-6">
              <p className="mb-1 text-sm font-medium text-foreground">Manage subscription</p>
              <p className="mb-3 text-xs text-muted-foreground">
                Update payment method, view invoices, or cancel your subscription
                via the Stripe billing portal.
              </p>
              <Button
                variant="outline"
                onClick={vm.handlePortal}
                disabled={vm.isOpeningPortal}
              >
                {vm.isOpeningPortal ? "Opening portal…" : "Manage Billing"}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
