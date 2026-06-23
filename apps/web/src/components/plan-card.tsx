import { Check } from "lucide-react";
import { cn } from "../lib/utils";
import type { BillingPlan } from "../api/billing.api";

export interface PlanCardData {
  plan: BillingPlan;
  name: string;
  priceLabel: string; // e.g. "$150"
  tagline: string;
  features: string[];
  featured?: boolean;
}

interface PlanCardProps {
  data: PlanCardData;
  selected: boolean;
  isLoading: boolean;
  disabled: boolean;
  onChoose: (plan: BillingPlan) => void;
}

export function PlanCard({ data, selected, isLoading, disabled, onChoose }: PlanCardProps) {
  const { plan, name, priceLabel, tagline, features, featured } = data;

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-xl border bg-white p-6 shadow-sm",
        featured ? "border-2 border-[#2563EB]" : "border border-[#E2E8F0]",
      )}
    >
      {featured && (
        <span className="absolute -top-3 right-6 rounded-full bg-[#2563EB] px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
          Most popular
        </span>
      )}

      <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
        {name}
      </p>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-4xl font-semibold tabular-nums text-[#041534]">
          {priceLabel}
        </span>
        <span className="text-sm text-[#64748B]">/mo</span>
      </div>
      <p className="mt-1 text-sm text-[#64748B]">{tagline}</p>

      <ul className="mt-5 flex flex-1 flex-col gap-3 border-t border-[#E2E8F0] pt-5">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-[#0F172A]">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#2563EB]" />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        disabled={disabled}
        onClick={() => onChoose(plan)}
        className={cn(
          "mt-6 h-11 w-full rounded-md text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
          featured
            ? "bg-[#2563EB] text-white hover:bg-[#1D4ED8]"
            : "border border-[#E2E8F0] bg-white text-[#0F172A] hover:bg-gray-50",
        )}
      >
        {isLoading && selected ? "Redirecting…" : `Choose ${name} →`}
      </button>
    </div>
  );
}
