import { Link } from "react-router";
import { useOnboardingCompleteViewModel } from "./onboarding-complete.view-model";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Card } from "../../components/ui/card";

function toTitleCase(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export default function OnboardingCompletePage() {
  const vm = useOnboardingCompleteViewModel();

  // ── Error state ──────────────────────────────────────────────────────────
  if (vm.status === "error") {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-semibold text-destructive">{vm.title}</h1>
        <p className="max-w-md text-muted-foreground">{vm.body}</p>
        <Button asChild variant="default">
          <Link to={vm.ctaHref}>{vm.ctaLabel}</Link>
        </Button>
      </div>
    );
  }

  // ── Loading state ────────────────────────────────────────────────────────
  if (vm.isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-foreground" />
      </div>
    );
  }

  // ── Success state ────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-2xl font-semibold text-success">{vm.title}</h1>

      {/* Connected businesses list */}
      <ul className="flex w-full max-w-sm flex-col gap-2">
        {vm.businesses.map((biz) => (
          <li key={biz.name}>
            <Card className="flex flex-row items-center justify-between gap-0 rounded-lg px-4 py-3">
              <span className="font-medium text-foreground">{biz.name}</span>
              <Badge variant="secondary">
                {toTitleCase(biz.accountingProvider)}
              </Badge>
            </Card>
          </li>
        ))}
      </ul>

      {/* CTAs */}
      {vm.canAddMore ? (
        <div className="flex flex-col items-center gap-3">
          <Button asChild variant="default">
            <Link to={vm.addMoreHref}>Connect another business</Link>
          </Button>
          <Button asChild variant="ghost" className="text-muted-foreground hover:text-foreground">
            <Link to={vm.dashboardHref}>Go to dashboard</Link>
          </Button>
        </div>
      ) : (
        <Button asChild variant="default">
          <Link to={vm.dashboardHref}>Go to dashboard</Link>
        </Button>
      )}
    </div>
  );
}
