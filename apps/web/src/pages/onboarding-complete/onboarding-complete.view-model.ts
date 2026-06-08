import { useSearchParams } from "react-router";
import { useBusinesses } from "../../queries/use-businesses";
import { useBillingStatus } from "../../queries/use-billing";
import type { BusinessWithConnections } from "../../api/businesses.api";

// ─── Error branch ────────────────────────────────────────────────────────────

const ERROR_COPY: Record<
  string,
  { title: string; body: string; ctaLabel: string }
> = {
  invalid_state: {
    title: "This link has expired",
    body: "The connection link is no longer valid. Please start the connection flow again from onboarding.",
    ctaLabel: "Restart onboarding",
  },
  token_exchange_failed: {
    title: "We couldn't finish the connection",
    body: "Your accounting provider didn't accept the authorization code. Please try connecting again.",
    ctaLabel: "Try again",
  },
  tenant_fetch_failed: {
    title: "We couldn't finish the connection",
    body: "We weren't able to look up your organisation from your accounting provider. Please try connecting again.",
    ctaLabel: "Try again",
  },
  multiple_tenants_not_supported: {
    title: "Your authorization included multiple organisations",
    body: "Nudge connects to one organisation at a time. Please reconnect and choose a single organisation when prompted.",
    ctaLabel: "Reconnect",
  },
  internal_error: {
    title: "Something went wrong on our end",
    body: "We hit an unexpected problem saving the connection. Please try again in a moment.",
    ctaLabel: "Try again",
  },
};

const GENERIC_ERROR = {
  title: "Something went wrong",
  body: "We couldn't complete the connection. Please try again.",
  ctaLabel: "Try again",
};

// ─── Discriminated return types ───────────────────────────────────────────────

interface ConnectedBusiness {
  name: string;
  accountingProvider: BusinessWithConnections["accountingProvider"];
}

interface SuccessViewModel {
  status: "success";
  title: string;
  businesses: ConnectedBusiness[];
  canAddMore: boolean;
  isLoading: boolean;
  dashboardHref: string;
  addMoreHref: string;
}

interface ErrorViewModel {
  status: "error";
  title: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
}

export type OnboardingCompleteViewModel = SuccessViewModel | ErrorViewModel;

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useOnboardingCompleteViewModel(): OnboardingCompleteViewModel {
  const [params] = useSearchParams();
  const status = params.get("status");
  const reason = params.get("reason") ?? "";

  // Call both hooks unconditionally (no conditional hooks).
  // They are harmless on the error path — small data, fast cache.
  const businessesQuery = useBusinesses();
  const billingQuery = useBillingStatus();

  if (status === "success") {
    const businesses: ConnectedBusiness[] = (businessesQuery.data ?? []).map(
      (b) => ({ name: b.name, accountingProvider: b.accountingProvider }),
    );

    const maxBusinesses =
      billingQuery.data?.limits?.maxBusinesses ?? 1;

    const canAddMore = businesses.length < maxBusinesses;

    const isLoading = businessesQuery.isLoading || billingQuery.isLoading;

    return {
      status: "success",
      title: "Connected!",
      businesses,
      canAddMore,
      isLoading,
      dashboardHref: "/dashboard",
      addMoreHref: "/onboarding",
    };
  }

  const copy = ERROR_COPY[reason] ?? GENERIC_ERROR;
  return {
    status: "error",
    title: copy.title,
    body: copy.body,
    ctaLabel: copy.ctaLabel,
    ctaHref: "/onboarding",
  };
}
