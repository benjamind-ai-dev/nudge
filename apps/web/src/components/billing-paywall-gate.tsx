import { Navigate, Outlet } from "react-router";
import { useBillingStatus } from "../queries/use-billing";

/**
 * Gates the billing paywall route (/onboarding/billing). A paid (active)
 * user has no reason to see the paywall — send them to the dashboard.
 *
 * Fails toward the paywall: if billing data is absent (error or undefined),
 * the status is not "active" so the paywall is shown. This is the safer
 * direction — the user can always pay again; accidentally skipping billing
 * for an unpaid user would break access.
 */
export function BillingPaywallGate() {
  const { data, isLoading } = useBillingStatus();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-gray-600" />
      </div>
    );
  }

  if (data?.status === "active") {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
