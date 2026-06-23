import { Check } from "lucide-react";
import { cn } from "../lib/utils";
import type { BillingPlan } from "../api/billing.api";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

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
    <Card
      className={cn(
        "relative gap-0 py-0",
        featured ? "border-2 border-primary ring-1 ring-primary" : "",
      )}
    >
      {featured && (
        <Badge
          variant="default"
          className="absolute -top-3 right-6 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide"
        >
          Most popular
        </Badge>
      )}

      <CardContent className="flex flex-1 flex-col px-6 py-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {name}
        </p>
        <div className="mt-2 flex items-baseline gap-1">
          <span className="text-4xl font-semibold tabular-nums text-foreground">
            {priceLabel}
          </span>
          <span className="text-sm text-muted-foreground">/mo</span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{tagline}</p>

        <ul className="mt-5 flex flex-1 flex-col gap-3 border-t border-border pt-5">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-2 text-sm text-foreground">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>{f}</span>
            </li>
          ))}
        </ul>

        <Button
          type="button"
          variant={featured ? "default" : "outline"}
          className="mt-6 h-11 w-full"
          disabled={disabled}
          onClick={() => onChoose(plan)}
        >
          {isLoading && selected ? "Redirecting…" : `Choose ${name} →`}
        </Button>
      </CardContent>
    </Card>
  );
}
