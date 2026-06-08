import { Navigate, Outlet } from "react-router";
import { useBusinesses } from "../queries/use-businesses";
import { useBillingStatus } from "../queries/use-billing";

/**
 * Gates the onboarding route (/onboarding). Once the account is fully set up
 * (all allowed business slots are connected), there's nothing left to do in
 * onboarding — redirect to the dashboard.
 *
 * Sits inside BillingGate, so billing is already enforced by the time this
 * gate runs. This gate only checks the connection cap.
 *
 * Fails open toward onboarding: if businesses data is absent (error or
 * undefined), connectedCount is 0, which is less than maxBusinesses, so
 * onboarding is shown. This is the safer direction — the user can always
 * reconnect; accidentally skipping onboarding for an unconnected user would
 * leave the dashboard with no data.
 */
export function OnboardingGate() {
  const businessesQuery = useBusinesses();
  const billingQuery = useBillingStatus();

  if (businessesQuery.isLoading || billingQuery.isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-gray-600" />
      </div>
    );
  }

  const connectedCount = (businessesQuery.data ?? []).filter((b) =>
    b.connections.some((c) => c.status === "connected"),
  ).length;

  const maxBusinesses = billingQuery.data?.limits?.maxBusinesses ?? 1;

  if (connectedCount >= maxBusinesses) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
