import { AlertCircle, BookOpen, Building2, Info, Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";
import { OnboardingBrandPanel } from "../../components/onboarding-brand-panel";
import { ProviderCard } from "../../components/provider-card";
import { useOnboardingViewModel } from "./onboarding.view-model";

// ---- Sub-components (dumb, local to this file) -------------------------

interface FieldLabelProps {
  htmlFor: string;
  children: React.ReactNode;
}

function FieldLabel({ htmlFor, children }: FieldLabelProps) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[#64748B]"
    >
      {children}
    </label>
  );
}

interface HelperProps {
  error?: string;
  hint?: string;
}

function FieldHelper({ error, hint }: HelperProps) {
  if (error) {
    return (
      <p className="mt-1 flex items-center gap-1 text-[12px] text-red-600">
        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
        {error}
      </p>
    );
  }
  if (hint) {
    return <p className="mt-1 text-[12px] text-[#64748B]">{hint}</p>;
  }
  return null;
}

const INPUT_BASE =
  "h-11 w-full rounded-[6px] border border-[#E2E8F0] px-3 text-sm text-[#1B2A4A] outline-none transition-colors focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] placeholder:text-[#94A3B8] bg-white box-border";

const INPUT_ERROR = "border-red-600 focus:border-red-600 focus:ring-red-600";

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
    <div className="flex min-h-screen bg-white">
      <OnboardingBrandPanel />

      <main className="flex flex-1 flex-col items-center justify-center px-6 py-12 md:px-12">
        {/* Widened from 520px → 600px so inputs have more breathing room */}
        <div className="box-border w-full max-w-[600px]">
          {/* Resume banner — mb-4 (was mb-6) to save vertical space */}
          {vm.isResume && (
            <div className="mb-4 flex items-start gap-2 rounded-md border border-blue-100 bg-blue-50 px-4 py-3 text-[13px] text-[#2563EB]">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              Your business is saved. Finish connecting your books to continue.
            </div>
          )}

          {/* Headline */}
          <h1 className="text-[28px] font-semibold text-[#1B2A4A]">
            Tell us about your business.
          </h1>
          <p className="mt-2 text-[14px] text-[#64748B]">
            We'll use this to send follow-ups on your behalf. Takes 30 seconds.
          </p>

          {/* Global submit error */}
          {vm.submitError && (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
              {vm.submitError}
            </div>
          )}

          {/* Form fields — gap-4 (was gap-5) to save vertical space */}
          <div className="mt-8 flex flex-col gap-4">
            {/* Business name */}
            <div>
              <FieldLabel htmlFor="businessName">Business name</FieldLabel>
              <input
                id="businessName"
                type="text"
                value={vm.businessName}
                onChange={(e) => {
                  vm.setBusinessName(e.target.value);
                  vm.markTouched("businessName");
                }}
                onBlur={() => vm.markTouched("businessName")}
                placeholder="Acme Plumbing Co."
                className={cn(INPUT_BASE, vm.errors.businessName && INPUT_ERROR)}
              />
              <FieldHelper error={vm.errors.businessName} />
            </div>

            {/* Sender name */}
            <div>
              <FieldLabel htmlFor="senderName">Sender name</FieldLabel>
              <input
                id="senderName"
                type="text"
                value={vm.senderName}
                onChange={(e) => {
                  vm.setSenderName(e.target.value);
                  vm.markTouched("senderName");
                }}
                onBlur={() => vm.markTouched("senderName")}
                placeholder="Jane Smith"
                className={cn(INPUT_BASE, vm.errors.senderName && INPUT_ERROR)}
              />
              <FieldHelper
                error={vm.errors.senderName}
                hint="Appears in the 'from' line of every reminder."
              />
            </div>

            {/* Sender email */}
            <div>
              <FieldLabel htmlFor="senderEmail">Sender email</FieldLabel>
              <input
                id="senderEmail"
                type="email"
                value={vm.senderEmail}
                onChange={(e) => {
                  vm.setSenderEmail(e.target.value);
                  vm.markTouched("senderEmail");
                }}
                onBlur={() => vm.markTouched("senderEmail")}
                placeholder="jane@acme.com"
                className={cn(INPUT_BASE, vm.errors.senderEmail && INPUT_ERROR)}
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
                  INPUT_BASE,
                  "cursor-pointer appearance-none",
                  vm.errors.timezone && INPUT_ERROR,
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
              <button
                type="button"
                onClick={vm.toggleSignature}
                className="cursor-pointer text-[13px] font-medium text-[#2563EB] transition-colors hover:text-[#1D4ED8]"
              >
                {vm.signatureOpen ? "− Remove email signature" : "+ Add email signature"}
              </button>
              {vm.signatureOpen && (
                <div className="mt-2">
                  <textarea
                    id="emailSignature"
                    value={vm.emailSignature}
                    onChange={(e) => vm.setEmailSignature(e.target.value)}
                    placeholder="Best regards,&#10;Jane Smith&#10;Acme Plumbing Co."
                    rows={4}
                    className="box-border w-full rounded-[6px] border border-[#E2E8F0] px-3 py-2 text-sm text-[#1B2A4A] outline-none transition-colors focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] placeholder:text-[#94A3B8]"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Connect section — mt-6 pt-5 (was mt-8 pt-6) to save vertical space */}
          <div className="mt-6 border-t border-gray-200 pt-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">
              Connect your books
            </p>
            <p className="mt-1 text-[13px] text-[#94A3B8]">
              Read-only access · We never modify your books · Disconnect anytime
            </p>

            {vm.errors.provider && (
              <p className="mt-2 flex items-center gap-1 text-[12px] text-red-600">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {vm.errors.provider}
              </p>
            )}

            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <ProviderCard
                provider="quickbooks"
                name="QuickBooks Online"
                description="Most US small businesses use this."
                logo={
                  <BookOpen className="h-6 w-6 text-[#10B981]" />
                }
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
                logo={
                  <Building2 className="h-6 w-6 text-[#2563EB]" />
                }
                selected={vm.provider === "xero"}
                onSelect={(p) => {
                  vm.setProvider(p);
                  vm.markTouched("provider");
                }}
              />
            </div>
          </div>

          {/* Submit — mt-6 (was mt-8) to save vertical space */}
          <button
            type="button"
            onClick={vm.handleSubmit}
            disabled={!vm.isValid || vm.isSubmitting}
            className={cn(
              "mt-6 h-11 w-full rounded-[6px] text-sm font-semibold transition-colors",
              vm.isValid && !vm.isSubmitting
                ? "cursor-pointer bg-[#2563EB] text-white hover:bg-[#1D4ED8]"
                : "cursor-not-allowed bg-[#E2E8F0] text-white",
            )}
          >
            {vm.isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Connecting…
              </span>
            ) : (
              vm.submitLabel
            )}
          </button>

          <p className="mt-3 text-center text-[12px] text-[#94A3B8]">
            You'll be redirected to {providerLabel} to authorize. Then we'll
            bring you back here.
          </p>
        </div>
      </main>
    </div>
  );
}
