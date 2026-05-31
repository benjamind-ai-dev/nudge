import { Bell } from "lucide-react";

interface TopbarProps {
  title: string;
  hasNotifications?: boolean;
}

export function Topbar({ title, hasNotifications = false }: TopbarProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-[#C5C6CF] bg-white px-6">
      <h1 className="text-xl font-semibold tracking-[0.01em] text-[#1A1C1C]">
        {title}
      </h1>
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
