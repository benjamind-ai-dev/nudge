import { Navigate, Outlet } from "react-router";
import { useBillingStatus } from "../queries/use-billing";

/**
 * Gates the in-app routes behind an active subscription. Wraps the app shell
 * only — onboarding routes (incl. the paywall) stay reachable while unpaid, so
 * there's no redirect loop. Anything other than `active` → the paywall.
 *
 * (No free trial: only `status === "active"` is allowed in. `trial`, `past_due`,
 * `canceled`, `incomplete`, or null plan are all treated as unpaid.)
 */
export function BillingGate() {
  const { data, isLoading, isError } = useBillingStatus();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-gray-600" />
      </div>
    );
  }

  // On error, don't hard-lock the user out of the app on a transient blip.
  if (!isError && data?.status !== "active") {
    return <Navigate to="/onboarding/billing" replace />;
  }

  return <Outlet />;
}
