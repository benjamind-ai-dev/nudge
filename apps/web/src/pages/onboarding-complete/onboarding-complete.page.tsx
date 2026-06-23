import { Link } from "react-router";
import { cn } from "../../lib/utils";
import { useOnboardingCompleteViewModel } from "./onboarding-complete.view-model";

function toTitleCase(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export default function OnboardingCompletePage() {
  const vm = useOnboardingCompleteViewModel();

  // ── Error state ──────────────────────────────────────────────────────────
  if (vm.status === "error") {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-semibold text-red-600">{vm.title}</h1>
        <p className="max-w-md text-gray-600">{vm.body}</p>
        <Link
          to={vm.ctaHref}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          {vm.ctaLabel}
        </Link>
      </div>
    );
  }

  // ── Loading state ────────────────────────────────────────────────────────
  if (vm.isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-gray-600" />
      </div>
    );
  }

  // ── Success state ────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-2xl font-semibold text-emerald-600">{vm.title}</h1>

      {/* Connected businesses list */}
      <ul className="flex w-full max-w-sm flex-col gap-2">
        {vm.businesses.map((biz) => (
          <li
            key={biz.name}
            className={cn(
              "flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3",
              "shadow-sm",
            )}
          >
            <span className="font-medium text-[#1B2A4A]">{biz.name}</span>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
              {toTitleCase(biz.accountingProvider)}
            </span>
          </li>
        ))}
      </ul>

      {/* CTAs */}
      {vm.canAddMore ? (
        <div className="flex flex-col items-center gap-3">
          <Link
            to={vm.addMoreHref}
            className="rounded-md px-5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#2563EB" }}
          >
            Connect another business
          </Link>
          <Link
            to={vm.dashboardHref}
            className="text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            Go to dashboard
          </Link>
        </div>
      ) : (
        <Link
          to={vm.dashboardHref}
          className="rounded-md px-5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: "#2563EB" }}
        >
          Go to dashboard
        </Link>
      )}
    </div>
  );
}
