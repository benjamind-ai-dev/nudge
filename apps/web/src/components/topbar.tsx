import { Bell, Menu } from "lucide-react";
import { Button } from "./ui/button";

interface TopbarProps {
  hasNotifications?: boolean;
  onMenuClick?: () => void;
}

export function Topbar({
  hasNotifications = false,
  onMenuClick,
}: TopbarProps) {
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
    </header>
  );
}
