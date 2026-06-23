import { NavLink } from "react-router";
import { useUser } from "@clerk/clerk-react";
import {
  LayoutDashboard,
  HandCoins,
  BarChart3,
  Users,
  Send,
  Settings,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "../lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/get-paid", label: "Get Paid", icon: HandCoins },
  { to: "/reports", label: "Reports", icon: BarChart3 },
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

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user } = useUser();
  const name = user?.fullName ?? "Account";
  const secondary = user?.primaryEmailAddress?.emailAddress ?? "";

  return (
    <>
      {/* Backdrop — mobile only, when the drawer is open */}
      {isOpen && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={onClose}
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-60 flex-col bg-[#1B2A4A] shadow-sm transition-transform duration-200 lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex flex-1 flex-col justify-between py-6">
          {/* Brand */}
          <div>
            <div className="flex items-center justify-between px-6 pb-10">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#7CBAFF]" />
                <span className="text-2xl font-bold tracking-[0.02em] text-white">
                  Nudge
                </span>
              </div>
              <button
                type="button"
                aria-label="Close menu"
                onClick={onClose}
                className="flex items-center justify-center rounded-md p-1 text-[#8392B7] transition-colors hover:bg-white/5 hover:text-white lg:hidden"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Nav */}
            <nav className="flex flex-col gap-1">
              {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={onClose}
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
    </>
  );
}
