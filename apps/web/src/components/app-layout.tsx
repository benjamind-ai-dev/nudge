import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

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
    <div className="min-h-screen bg-muted">
      <Sidebar isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <div className="flex min-h-screen flex-col lg:pl-60">
        <Topbar onMenuClick={() => setDrawerOpen(true)} />
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
