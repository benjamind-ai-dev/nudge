import { ChevronLeft } from "lucide-react";
import { Button } from "./ui/button";

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
    <Button variant="ghost" size="sm" asChild className="gap-1 px-0 text-muted-foreground hover:text-foreground">
      <a href={MARKETING_URL}>
        <ChevronLeft className="h-3.5 w-3.5" />
        Back
      </a>
    </Button>
  );
}
