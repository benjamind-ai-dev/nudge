import { Outlet, useLocation } from "react-router";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

const ROUTE_TITLES: { prefix: string; title: string }[] = [
  { prefix: "/dashboard", title: "Dashboard" },
  { prefix: "/invoices", title: "Invoices" },
  { prefix: "/customers", title: "Customers" },
  { prefix: "/sequences", title: "Sequences" },
  { prefix: "/settings", title: "Settings" },
];

function titleForPath(pathname: string): string {
  const match = ROUTE_TITLES.find((r) => pathname.startsWith(r.prefix));
  return match?.title ?? "Nudge";
}

export function AppLayout() {
  const { pathname } = useLocation();

  return (
    <div className="min-h-screen bg-[#F9F9F9]">
      <Sidebar />
      <div className="flex min-h-screen flex-col pl-60">
        <Topbar title={titleForPath(pathname)} />
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
