import { Routes, Route } from "react-router";
import SignIn from "./pages/sign-in";
import Dashboard from "./pages/dashboard";
import Customers from "./pages/customers";
import Invoices from "./pages/invoices";
import Sequences from "./pages/sequences";
import Reports from "./pages/reports";
import Settings from "./pages/settings";

export default function App() {
  return (
    <Routes>
      <Route path="/sign-in" element={<SignIn />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/customers" element={<Customers />} />
      <Route path="/invoices" element={<Invoices />} />
      <Route path="/sequences" element={<Sequences />} />
      <Route path="/reports" element={<Reports />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="*" element={<Dashboard />} />
    </Routes>
  );
}
