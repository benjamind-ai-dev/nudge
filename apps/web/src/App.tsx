import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router";
import { useAuth } from "@clerk/clerk-react";
import { setTokenGetter } from "./api/client";
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
import OnboardingComplete from "./pages/onboarding-complete/onboarding-complete.page";
import Dashboard from "./pages/dashboard";
import Customers from "./pages/customers";
import Invoices from "./pages/invoices";
import Sequences from "./pages/sequences";
import Reports from "./pages/reports";
import Settings from "./pages/settings";
import { BillingPage } from "./pages/billing/billing.page";

function ClerkTokenBridge() {
  const { getToken } = useAuth();
  useEffect(() => {
    setTokenGetter(() => getToken());
  }, [getToken]);
  return null;
}

export default function App() {
  return (
    <>
      <ClerkTokenBridge />
      <Routes>
        {/* Public */}
        <Route path="/sign-in/*" element={<SignInPage />} />
        <Route path="/sign-up/*" element={<SignUpPage />} />

        {/* Protected */}
        <Route element={<ProtectedRoute />}>
          <Route element={<BillingPaywallGate />}>
            <Route path="/onboarding/billing" element={<OnboardingBillingPage />} />
          </Route>
          <Route path="/onboarding/complete" element={<OnboardingComplete />} />
          <Route element={<BillingGate />}>
            <Route element={<OnboardingGate />}>
              <Route path="/onboarding" element={<OnboardingPage />} />
            </Route>
            <Route element={<ConnectionGate />}>
              <Route element={<AppLayout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/customers" element={<Customers />} />
                <Route path="/invoices" element={<Invoices />} />
                <Route path="/sequences" element={<Sequences />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/settings/billing" element={<BillingPage />} />
              </Route>
            </Route>
          </Route>
        </Route>

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </>
  );
}
