import { ChevronLeft } from "lucide-react";

// The marketing/landing site URL. Set VITE_MARKETING_URL once the landing page
// exists (domain is paynudge.com). Until then the link is hidden so it never
// navigates to an unintended domain. TODO(linear): wire the real landing URL.
const MARKETING_URL = import.meta.env.VITE_MARKETING_URL;

/**
 * "← Back" link to the marketing site. Renders nothing until
 * VITE_MARKETING_URL is configured.
 */
export function BackToMarketingLink() {
  if (!MARKETING_URL) return null;

  return (
    <a
      href={MARKETING_URL}
      className="inline-flex items-center gap-1.5 text-[13px] text-[#45464E] transition-colors hover:text-[#1A1C1C]"
    >
      <ChevronLeft className="h-3.5 w-3.5" />
      Back
    </a>
  );
}
