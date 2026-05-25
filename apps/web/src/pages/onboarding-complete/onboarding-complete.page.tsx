import { Link } from "react-router";
import { useOnboardingCompleteViewModel } from "./onboarding-complete.view-model";

export default function OnboardingCompletePage() {
  const vm = useOnboardingCompleteViewModel();
  const accent =
    vm.status === "success" ? "text-emerald-600" : "text-red-600";

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className={`text-2xl font-semibold ${accent}`}>{vm.title}</h1>
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
