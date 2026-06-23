import { Bell, Menu, Monitor, Moon, Sun } from "lucide-react";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { useThemeStore, type ThemeMode } from "../stores/theme.store";

interface TopbarProps {
  hasNotifications?: boolean;
  onMenuClick?: () => void;
}

const themeOptions: {
  mode: ThemeMode;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}[] = [
  { mode: "light", label: "Light", Icon: Sun },
  { mode: "dark", label: "Dark", Icon: Moon },
  { mode: "system", label: "System", Icon: Monitor },
];

/**
 * No full-width bar — that left an empty band above every page. Instead the
 * global controls float in the corners over the content: a mobile menu button
 * top-left, theme + notifications top-right. Pages start at the top.
 */
export function Topbar({ hasNotifications = false, onMenuClick }: TopbarProps) {
  const { mode, setMode } = useThemeStore();
  const ActiveIcon = mode === "light" ? Sun : mode === "dark" ? Moon : Monitor;

  return (
    <>
      {/* Mobile drawer trigger — top-left, content gets pt-12 on mobile to clear it */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Open menu"
        onClick={onMenuClick}
        className="fixed left-3 top-3 z-40 lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Global actions — top-right, floating over the content (no band) */}
      <div className="fixed right-4 top-3 z-40 flex items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Switch theme"
              className="rounded-full"
            >
              <ActiveIcon className="h-5 w-5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {themeOptions.map(({ mode: m, label, Icon }) => (
              <DropdownMenuItem
                key={m}
                onClick={() => setMode(m)}
                className={mode === m ? "font-medium text-primary" : ""}
              >
                <Icon className="mr-2 h-4 w-4" />
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="relative">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Notifications"
            className="rounded-full"
          >
            <Bell className="h-5 w-5 text-muted-foreground" />
          </Button>
          {hasNotifications && (
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full border-2 border-background bg-destructive" />
          )}
        </div>
      </div>
    </>
  );
}
