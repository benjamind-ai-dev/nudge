import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router";
import { useAuth } from "@clerk/clerk-react";
import { setTokenGetter } from "./api/client";
import { ProtectedRoute } from "./components/protected-route";
import { AppLayout } from "./components/app-layout";
import SignIn from "./pages/sign-in";
import SignUp from "./pages/sign-up";
import Onboarding from "./pages/onboarding";
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
        <Route path="/sign-in" element={<SignIn />} />
        <Route path="/sign-up" element={<SignUp />} />

        {/* Protected */}
        <Route element={<ProtectedRoute />}>
          <Route path="/onboarding" element={<Onboarding />} />
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

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </>
  );
}
