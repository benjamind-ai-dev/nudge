import { NavLink } from "react-router";
import { useUser } from "@clerk/clerk-react";
import {
  LayoutDashboard,
  FileText,
  Users,
  Send,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { cn } from "../lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/invoices", label: "Invoices", icon: FileText },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/sequences", label: "Sequences", icon: Send },
  { to: "/settings", label: "Settings", icon: Settings },
];

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function Sidebar() {
  const { user } = useUser();
  const name = user?.fullName ?? "Account";
  const secondary = user?.primaryEmailAddress?.emailAddress ?? "";

  return (
    <aside className="fixed inset-y-0 left-0 flex w-60 flex-col bg-[#1B2A4A] shadow-sm">
      <div className="flex flex-1 flex-col justify-between py-6">
        {/* Brand */}
        <div>
          <div className="flex items-center gap-2 px-6 pb-10">
            <span className="h-2.5 w-2.5 rounded-full bg-[#7CBAFF]" />
            <span className="font-display text-2xl font-bold tracking-tight text-white">
              Nudge
            </span>
          </div>

          {/* Nav */}
          <nav className="flex flex-col gap-1">
            {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 border-l-4 border-transparent px-4 py-3 text-sm transition-colors",
                    isActive
                      ? "border-[#7CBAFF] bg-[rgba(46,117,182,0.18)] font-medium text-white"
                      : "text-[#8392B7] hover:bg-white/5 hover:text-white",
                  )
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        {/* User card */}
        <div className="px-4">
          <div className="flex items-center gap-3 rounded-lg border border-[rgba(56,70,104,0.2)] bg-[rgba(56,70,104,0.1)] p-3">
            {user?.imageUrl ? (
              <img
                src={user.imageUrl}
                alt={name}
                className="h-10 w-10 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20 text-sm font-medium text-white">
                {initials(name)}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{name}</p>
              {secondary && (
                <p className="truncate text-[13px] text-[#8392B7]">{secondary}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
