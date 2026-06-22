import { Bell, Menu } from "lucide-react";

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
    <header className="flex h-14 items-center justify-between border-b border-[#C5C6CF] bg-white px-4 sm:px-6">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Open menu"
          onClick={onMenuClick}
          className="flex items-center justify-center rounded-md p-2 text-[#45464E] transition-colors hover:bg-gray-100 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-semibold tracking-[0.01em] text-[#1A1C1C]">
          {title}
        </h1>
      </div>
      <button
        type="button"
        aria-label="Notifications"
        className="relative flex items-center justify-center rounded-full p-2 transition-colors hover:bg-gray-100"
      >
        <Bell className="h-5 w-5 text-[#45464E]" />
        {hasNotifications && (
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full border-2 border-white bg-[#BA1A1A]" />
        )}
      </button>
    </header>
  );
}
