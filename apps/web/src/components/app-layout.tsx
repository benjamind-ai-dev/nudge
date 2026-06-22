import { useEffect, useState } from "react";
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
  // Drawer open is pure UI shell state — kept local rather than pulling in a
  // store dependency for a single boolean.
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-screen bg-[#F9F9F9]">
      <Sidebar isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <div className="flex min-h-screen flex-col lg:pl-60">
        <Topbar
          title={titleForPath(pathname)}
          onMenuClick={() => setDrawerOpen(true)}
        />
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
