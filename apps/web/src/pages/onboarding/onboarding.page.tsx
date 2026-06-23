import { AlertCircle, BookOpen, Building2, Info, Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";
import { OnboardingBrandPanel } from "../../components/onboarding-brand-panel";
import { ProviderCard } from "../../components/provider-card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Button } from "../../components/ui/button";
import { useOnboardingViewModel } from "./onboarding.view-model";

// ---- Sub-components (dumb, local to this file) -------------------------

interface FieldLabelProps {
  htmlFor: string;
  children: React.ReactNode;
}

function FieldLabel({ htmlFor, children }: FieldLabelProps) {
  return (
    <Label
      htmlFor={htmlFor}
      className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
    >
      {children}
    </Label>
  );
}

interface HelperProps {
  error?: string;
  hint?: string;
}

function FieldHelper({ error, hint }: HelperProps) {
  if (error) {
    return (
      <p className="mt-1 flex items-center gap-1 text-[12px] text-destructive">
        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
        {error}
      </p>
    );
  }
  if (hint) {
    return <p className="mt-1 text-[12px] text-muted-foreground">{hint}</p>;
  }
  return null;
}

// ---- Page ---------------------------------------------------------------

export function OnboardingPage() {
  const vm = useOnboardingViewModel();

  const providerLabel =
    vm.provider === "quickbooks"
      ? "QuickBooks"
      : vm.provider === "xero"
        ? "Xero"
        : "your accounting software";

  return (
    <div className="flex min-h-screen bg-background">
      <OnboardingBrandPanel />

      <main className="flex flex-1 flex-col items-center justify-center px-6 py-12 md:px-12">
        {/* Widened from 520px → 600px so inputs have more breathing room */}
        <div className="box-border w-full max-w-[600px]">
          {/* Resume banner */}
          {vm.isResume && (
            <div className="mb-4 flex items-start gap-2 rounded-md border border-accent bg-accent px-4 py-3 text-[13px] text-accent-foreground">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              Your business is saved. Finish connecting your books to continue.
            </div>
          )}

          {/* Headline */}
          <h1 className="text-[28px] font-semibold text-foreground">
            Tell us about your business.
          </h1>
          <p className="mt-2 text-[14px] text-muted-foreground">
            We'll use this to send follow-ups on your behalf. Takes 30 seconds.
          </p>

          {/* Global submit error */}
          {vm.submitError && (
            <div className="mt-4 rounded-md border border-destructive/20 bg-destructive/5 px-4 py-3 text-[13px] text-destructive">
              {vm.submitError}
            </div>
          )}

          {/* Form fields */}
          <div className="mt-8 flex flex-col gap-4">
            {/* Business name */}
            <div>
              <FieldLabel htmlFor="businessName">Business name</FieldLabel>
              <Input
                id="businessName"
                type="text"
                value={vm.businessName}
                onChange={(e) => {
                  vm.setBusinessName(e.target.value);
                  vm.markTouched("businessName");
                }}
                onBlur={() => vm.markTouched("businessName")}
                placeholder="Acme Plumbing Co."
                aria-invalid={Boolean(vm.errors.businessName)}
                className="h-11"
              />
              <FieldHelper error={vm.errors.businessName} />
            </div>

            {/* Sender name */}
            <div>
              <FieldLabel htmlFor="senderName">Sender name</FieldLabel>
              <Input
                id="senderName"
                type="text"
                value={vm.senderName}
                onChange={(e) => {
                  vm.setSenderName(e.target.value);
                  vm.markTouched("senderName");
                }}
                onBlur={() => vm.markTouched("senderName")}
                placeholder="Jane Smith"
                aria-invalid={Boolean(vm.errors.senderName)}
                className="h-11"
              />
              <FieldHelper
                error={vm.errors.senderName}
                hint="Appears in the 'from' line of every reminder."
              />
            </div>

            {/* Sender email */}
            <div>
              <FieldLabel htmlFor="senderEmail">Sender email</FieldLabel>
              <Input
                id="senderEmail"
                type="email"
                value={vm.senderEmail}
                onChange={(e) => {
                  vm.setSenderEmail(e.target.value);
                  vm.markTouched("senderEmail");
                }}
                onBlur={() => vm.markTouched("senderEmail")}
                placeholder="jane@acme.com"
                aria-invalid={Boolean(vm.errors.senderEmail)}
                className="h-11"
              />
              <FieldHelper
                error={vm.errors.senderEmail}
                hint="Replies come back to this address."
              />
            </div>

            {/* Timezone */}
            <div>
              <FieldLabel htmlFor="timezone">Timezone</FieldLabel>
              <select
                id="timezone"
                value={vm.timezone}
                onChange={(e) => {
                  vm.setTimezone(e.target.value);
                  vm.markTouched("timezone");
                }}
                onBlur={() => vm.markTouched("timezone")}
                className={cn(
                  "h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground outline-none transition-colors focus:border-ring focus:ring-1 focus:ring-ring cursor-pointer appearance-none",
                  vm.errors.timezone && "border-destructive focus:border-destructive focus:ring-destructive",
                )}
              >
                {vm.timezones.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
              <FieldHelper
                error={vm.errors.timezone}
                hint="Used to decide when reminders go out."
              />
            </div>

            {/* Email signature (collapsible) */}
            <div>
              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={vm.toggleSignature}
                className="h-auto p-0 text-[13px]"
              >
                {vm.signatureOpen ? "− Remove email signature" : "+ Add email signature"}
              </Button>
              {vm.signatureOpen && (
                <div className="mt-2">
                  <textarea
                    id="emailSignature"
                    value={vm.emailSignature}
                    onChange={(e) => vm.setEmailSignature(e.target.value)}
                    placeholder={"Best regards,\nJane Smith\nAcme Plumbing Co."}
                    rows={4}
                    className="box-border w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-ring focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Connect section */}
          <div className="mt-6 border-t border-border pt-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Connect your books
            </p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Read-only access · We never modify your books · Disconnect anytime
            </p>

            {vm.errors.provider && (
              <p className="mt-2 flex items-center gap-1 text-[12px] text-destructive">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {vm.errors.provider}
              </p>
            )}

            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <ProviderCard
                provider="quickbooks"
                name="QuickBooks Online"
                description="Most US small businesses use this."
                logo={<BookOpen className="h-6 w-6 text-[#10B981]" />}
                selected={vm.provider === "quickbooks"}
                onSelect={(p) => {
                  vm.setProvider(p);
                  vm.markTouched("provider");
                }}
              />
              <ProviderCard
                provider="xero"
                name="Xero"
                description="Popular in UK, AU, NZ."
                logo={<Building2 className="h-6 w-6 text-primary" />}
                selected={vm.provider === "xero"}
                onSelect={(p) => {
                  vm.setProvider(p);
                  vm.markTouched("provider");
                }}
              />
            </div>
          </div>

          {/* Submit */}
          <Button
            type="button"
            variant="default"
            className="mt-6 h-11 w-full"
            onClick={vm.handleSubmit}
            disabled={!vm.isValid || vm.isSubmitting}
          >
            {vm.isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Connecting…
              </span>
            ) : (
              vm.submitLabel
            )}
          </Button>

          <p className="mt-3 text-center text-[12px] text-muted-foreground">
            You'll be redirected to {providerLabel} to authorize. Then we'll
            bring you back here.
          </p>
        </div>
      </main>
    </div>
  );
}
