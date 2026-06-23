import { Bell, Menu } from "lucide-react";
import { Button } from "./ui/button";

interface TopbarProps {
  title: string;
  hasNotifications?: boolean;
  onMenuClick?: () => void;
}

export function Topbar({
  title,
  hasNotifications = false,
  onMenuClick,
}: TopbarProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-background px-4 sm:px-6">
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
        <h1 className="text-xl font-semibold tracking-[0.01em] text-foreground">
          {title}
        </h1>
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
