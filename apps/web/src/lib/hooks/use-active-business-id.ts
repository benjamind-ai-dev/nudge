import { useBusinesses } from "../../queries/use-businesses";

interface ActiveBusiness {
  /** "" until the businesses list resolves — pair with `enabled: Boolean(id)`. */
  businessId: string;
  isLoading: boolean;
  /** The account has more than one business — drives the deferred labeled view. */
  hasMultiple: boolean;
}

/**
 * Resolves the business the dashboard should render for. Today an account has
 * one connected business, so we pick the first connected one (falling back to
 * the first business). When multi-business in-app display lands, this is the
 * seam to swap for a selected-business id.
 */
export function useActiveBusinessId(): ActiveBusiness {
  const { data, isLoading } = useBusinesses();
  const businesses = data ?? [];

  const connected = businesses.find((b) =>
    b.connections.some((c) => c.status === "connected"),
  );
  const active = connected ?? businesses[0];

  return {
    businessId: active?.id ?? "",
    isLoading,
    hasMultiple: businesses.length > 1,
  };
}
