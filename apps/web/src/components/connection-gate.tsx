import { Navigate, Outlet } from "react-router";
import { useBusinesses } from "../queries/use-businesses";

/**
 * Gates the in-app routes behind a connected accounting integration. Sits
 * inside BillingGate (paid users only) and wraps the app shell.
 *
 * A paid user who created a business but never finished OAuth (abandoned the
 * provider redirect) has a business with no `connected` connection. Send them
 * to /onboarding, where resume mode detects that business and lets them finish
 * connecting without creating a duplicate.
 *
 * Fails CLOSED: the dashboard renders only once a connected business is
 * confirmed. While loading we show a spinner; on no-connection OR a query
 * error we route to /onboarding (an unconnected dashboard has no data anyway,
 * and /onboarding surfaces the real state). /onboarding is NOT behind this
 * gate (sibling route), so there's no redirect loop.
 */
export function ConnectionGate() {
  const { data, isLoading } = useBusinesses();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-gray-600" />
      </div>
    );
  }

  const hasConnectedBusiness = (data ?? []).some((business) =>
    business.connections.some((connection) => connection.status === "connected"),
  );

  if (!hasConnectedBusiness) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
}
