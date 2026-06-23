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

const themeOptions: { mode: ThemeMode; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { mode: "light", label: "Light", Icon: Sun },
  { mode: "dark", label: "Dark", Icon: Moon },
  { mode: "system", label: "System", Icon: Monitor },
];

export function Topbar({
  hasNotifications = false,
  onMenuClick,
}: TopbarProps) {
  const { mode, setMode } = useThemeStore();

  // Determine icon to show based on current effective theme
  // For system, we still show Monitor; for explicit light/dark show Sun/Moon
  const ActiveIcon = mode === "light" ? Sun : mode === "dark" ? Moon : Monitor;

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-background px-4 sm:px-6">
      {/* Page titles live in each page's own header — keep the bar chrome-only. */}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Open menu"
          onClick={onMenuClick}
          className="lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </div>
      <div className="flex items-center gap-1">
        {/* Theme switcher */}
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

        {/* Notifications */}
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
    </header>
  );
}
