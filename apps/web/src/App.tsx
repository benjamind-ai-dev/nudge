import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router";
import { useAuth } from "@clerk/clerk-react";
import { setTokenGetter } from "./api/client";
import { useApplyTheme } from "./lib/hooks/use-apply-theme";
import { ProtectedRoute } from "./components/protected-route";
import { AppLayout } from "./components/app-layout";
import { BillingGate } from "./components/billing-gate";
import { BillingPaywallGate } from "./components/billing-paywall-gate";
import { ConnectionGate } from "./components/connection-gate";
import { OnboardingGate } from "./components/onboarding-gate";
import { SignInPage } from "./pages/sign-in";
import { SignUpPage } from "./pages/sign-up";
import { OnboardingPage } from "./pages/onboarding/onboarding.page";
import { OnboardingBillingPage } from "./pages/onboarding-billing/onboarding-billing.page";
import { OnboardingCompletePage } from "./pages/onboarding-complete/onboarding-complete.page";
import { DashboardPage } from "./pages/dashboard/dashboard.page";
import { CustomersPage } from "./pages/customers";
import { InvoicesPage } from "./pages/invoices";
import { SequencesPage } from "./pages/sequences";
import { ReportsPage } from "./pages/reports/reports.page";
import { GetPaidPage } from "./pages/get-paid/get-paid.page";
import { SettingsPage } from "./pages/settings";
import { BillingPage } from "./pages/billing/billing.page";

function ClerkTokenBridge() {
  const { getToken } = useAuth();
  useEffect(() => {
    setTokenGetter(() => getToken());
  }, [getToken]);
  return null;
}

function ThemeApplier() {
  useApplyTheme();
  return null;
}

export default function App() {
  return (
    <>
      <ClerkTokenBridge />
      <ThemeApplier />
      <Routes>
        {/* Public */}
        <Route path="/sign-in/*" element={<SignInPage />} />
        <Route path="/sign-up/*" element={<SignUpPage />} />

        {/* Protected */}
        <Route element={<ProtectedRoute />}>
          <Route element={<BillingPaywallGate />}>
            <Route path="/onboarding/billing" element={<OnboardingBillingPage />} />
          </Route>
          <Route path="/onboarding/complete" element={<OnboardingCompletePage />} />
          <Route element={<BillingGate />}>
            <Route element={<OnboardingGate />}>
              <Route path="/onboarding" element={<OnboardingPage />} />
            </Route>
            <Route element={<ConnectionGate />}>
              <Route element={<AppLayout />}>
                <Route path="/get-paid" element={<GetPaidPage />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/customers" element={<CustomersPage />} />
                <Route path="/invoices" element={<InvoicesPage />} />
                <Route path="/sequences" element={<SequencesPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/settings/billing" element={<BillingPage />} />
              </Route>
            </Route>
          </Route>
        </Route>

        <Route path="/" element={<Navigate to="/get-paid" replace />} />
        <Route path="*" element={<Navigate to="/get-paid" replace />} />
      </Routes>
    </>
  );
}
