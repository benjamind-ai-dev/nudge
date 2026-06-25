import type { ReactNode } from "react";
import { cn } from "../lib/utils";
import { Card } from "./ui/card";

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
    <Card
      role="button"
      tabIndex={0}
      onClick={() => onSelect(provider)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(provider);
        }
      }}
      className={cn(
        "flex flex-1 cursor-pointer flex-row items-center gap-3 rounded-md py-3 px-3 text-left transition-colors",
        selected
          ? "border-2 border-primary bg-accent"
          : "border-border bg-card hover:bg-muted",
      )}
    >
      {/* Radio circle */}
      <span
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
          selected ? "border-primary bg-primary" : "border-border bg-card",
        )}
      >
        {selected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
      </span>

      {/* Logo */}
      <span className="flex h-8 w-8 shrink-0 items-center justify-center">
        {logo}
      </span>

      {/* Text */}
      <span className="flex flex-col">
        <span className="text-[15px] font-semibold text-foreground">{name}</span>
        <span className="text-xs text-muted-foreground">{description}</span>
      </span>
    </Card>
  );
}
