import { UserButton, OrganizationSwitcher } from "@clerk/clerk-react";
import { NavLink, Outlet } from "react-router";

const NAV_LINKS = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/invoices", label: "Invoices" },
  { to: "/customers", label: "Customers" },
  { to: "/sequences", label: "Sequences" },
  { to: "/reports", label: "Reports" },
  { to: "/settings", label: "Settings" },
];

export function AppLayout() {
  return (
    <div className="flex h-screen">
      <aside className="flex w-56 flex-col border-r bg-white px-3 py-4">
        <div className="mb-6 px-2 text-lg font-semibold">Nudge</div>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV_LINKS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto pt-4">
          <OrganizationSwitcher hidePersonal />
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center justify-end border-b bg-white px-6">
          <UserButton />
        </header>
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
