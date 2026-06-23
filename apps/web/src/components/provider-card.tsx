import type { ReactNode } from "react";
import { cn } from "../lib/utils";

interface ProviderCardProps {
  provider: "quickbooks" | "xero";
  name: string;
  description: string;
  logo: ReactNode;
  selected: boolean;
  onSelect: (provider: "quickbooks" | "xero") => void;
}

export function ProviderCard({
  provider,
  name,
  description,
  logo,
  selected,
  onSelect,
}: ProviderCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(provider)}
      className={cn(
        "flex flex-1 cursor-pointer items-center gap-3 rounded-md border p-3 text-left transition-colors",
        selected
          ? "border-2 border-[#2563EB] bg-blue-50"
          : "border border-[#E2E8F0] bg-white hover:bg-gray-50",
      )}
    >
      {/* Radio circle */}
      <span
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
          selected
            ? "border-[#2563EB] bg-[#2563EB]"
            : "border-[#E2E8F0] bg-white",
        )}
      >
        {selected && (
          <span className="h-1.5 w-1.5 rounded-full bg-white" />
        )}
      </span>

      {/* Logo */}
      <span className="flex h-8 w-8 shrink-0 items-center justify-center">
        {logo}
      </span>

      {/* Text */}
      <span className="flex flex-col">
        <span className="text-[15px] font-semibold text-[#1B2A4A]">{name}</span>
        <span className="text-xs text-[#64748B]">{description}</span>
      </span>
    </button>
  );
}
