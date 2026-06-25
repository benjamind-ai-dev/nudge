import { Menu } from "lucide-react";
import { Button } from "./ui/button";

interface TopbarProps {
  onMenuClick?: () => void;
}

/**
 * No full-width bar and no floating global actions — theme lives in Settings,
 * notifications aren't built yet. Only the mobile drawer trigger floats
 * top-left; on desktop the shell is chrome-free and pages start at the top.
 */
export function Topbar({ onMenuClick }: TopbarProps) {
  return (
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
  );
}
