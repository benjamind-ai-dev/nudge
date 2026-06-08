import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUser } from "@clerk/clerk-react";
import { useBusinesses, useCreateBusiness } from "../../queries/use-businesses";
import { useAuthorizeConnection } from "../../queries/use-connections";

// Curated timezone list covering common US zones + London/Sydney/Auckland.
// The auto-detected zone is prepended if not already present.
const CURATED_TIMEZONES = [
  { value: "America/New_York", label: "(GMT-05:00) Eastern Time" },
  { value: "America/Chicago", label: "(GMT-06:00) Central Time" },
  { value: "America/Denver", label: "(GMT-07:00) Mountain Time" },
  { value: "America/Los_Angeles", label: "(GMT-08:00) Pacific Time" },
  { value: "America/Anchorage", label: "(GMT-09:00) Alaska Time" },
  { value: "Pacific/Honolulu", label: "(GMT-10:00) Hawaii Time" },
  { value: "America/Phoenix", label: "(GMT-07:00) Arizona (no DST)" },
  { value: "Europe/London", label: "(GMT+00:00) London" },
  { value: "Europe/Paris", label: "(GMT+01:00) Central European Time" },
  { value: "Asia/Dubai", label: "(GMT+04:00) Dubai" },
  { value: "Australia/Sydney", label: "(GMT+11:00) Sydney" },
  { value: "Pacific/Auckland", label: "(GMT+13:00) Auckland" },
];

function buildTimezones() {
  const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const alreadyPresent = CURATED_TIMEZONES.some((tz) => tz.value === detected);
  if (alreadyPresent) return CURATED_TIMEZONES;
  // Prepend detected zone with a readable label
  return [{ value: detected, label: detected }, ...CURATED_TIMEZONES];
}

const TIMEZONES = buildTimezones();

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

type TouchableField = "businessName" | "senderName" | "senderEmail" | "timezone" | "provider";

interface TouchedState {
  businessName?: boolean;
  senderName?: boolean;
  senderEmail?: boolean;
  timezone?: boolean;
  provider?: boolean;
}

interface FormErrors {
  businessName?: string;
  senderName?: string;
  senderEmail?: string;
  timezone?: string;
  provider?: string;
}

function validateFields(
  businessName: string,
  senderName: string,
  senderEmail: string,
  timezone: string,
  provider: "quickbooks" | "xero" | null,
): FormErrors {
  const errors: FormErrors = {};

  if (!businessName.trim()) {
    errors.businessName = "Enter your business name.";
  }
  if (!senderName.trim()) {
    errors.senderName = "Enter a sender name.";
  }
  if (!isValidEmail(senderEmail)) {
    errors.senderEmail = "Enter a valid email address.";
  }
  if (!timezone) {
    errors.timezone = "Select a timezone.";
  }
  if (!provider) {
    errors.provider = "Select an accounting provider.";
  }

  return errors;
}

const ALL_TOUCHED: TouchedState = {
  businessName: true,
  senderName: true,
  senderEmail: true,
  timezone: true,
  provider: true,
};

export function useOnboardingViewModel() {
  const { user } = useUser();

  const clerkEmail = user?.primaryEmailAddress?.emailAddress ?? "";

  const businessesQuery = useBusinesses();
  const createBusiness = useCreateBusiness();
  const authorizeConnection = useAuthorizeConnection();

  const [businessName, setBusinessName] = useState("");
  const [senderName, setSenderName] = useState("");
  const [senderEmail, setSenderEmail] = useState(clerkEmail);
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  const [emailSignature, setEmailSignature] = useState("");
  const [provider, setProvider] = useState<"quickbooks" | "xero" | null>(null);
  const [signatureOpen, setSignatureOpen] = useState(false);
  const [touched, setTouched] = useState<TouchedState>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Derive the first business that has no "connected" connection (resume candidate)
  const resumeBusiness = useMemo(() => {
    const businesses = businessesQuery.data ?? [];
    return (
      businesses.find(
        (b) => !b.connections.some((c) => c.status === "connected"),
      ) ?? null
    );
  }, [businessesQuery.data]);

  const isResume = Boolean(resumeBusiness);

  // Track which businessId we've already prefilled for — prevents clobbering user edits
  const prefilledIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!resumeBusiness) return;
    if (prefilledIdRef.current === resumeBusiness.id) return;
    prefilledIdRef.current = resumeBusiness.id;

    setBusinessName(resumeBusiness.name);
    setSenderName(resumeBusiness.senderName);
    setSenderEmail(resumeBusiness.senderEmail);
    setTimezone(resumeBusiness.timezone);
    setEmailSignature(resumeBusiness.emailSignature ?? "");
    setProvider(resumeBusiness.accountingProvider);
    if (resumeBusiness.emailSignature) {
      setSignatureOpen(true);
    }
  }, [resumeBusiness]);

  const submitLabel = isResume ? "Connect" : "Continue →";

  const toggleSignature = useCallback(() => {
    setSignatureOpen((prev) => !prev);
  }, []);

  // Mark a single field as touched (called on blur or first change, or all on submit)
  const markTouched = useCallback((field: TouchableField) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }, []);

  // All raw validation errors (computed from current values)
  const allErrors = useMemo(
    () => validateFields(businessName, senderName, senderEmail, timezone, provider),
    [businessName, senderName, senderEmail, timezone, provider],
  );

  // Touched-gated errors: only show an error for a field once it has been touched.
  // On submit we set all fields touched (see handleSubmit), so all errors surface.
  const errors = useMemo<FormErrors>(() => {
    const gated: FormErrors = {};
    if (touched.businessName && allErrors.businessName) gated.businessName = allErrors.businessName;
    if (touched.senderName && allErrors.senderName) gated.senderName = allErrors.senderName;
    if (touched.senderEmail && allErrors.senderEmail) gated.senderEmail = allErrors.senderEmail;
    if (touched.timezone && allErrors.timezone) gated.timezone = allErrors.timezone;
    if (touched.provider && allErrors.provider) gated.provider = allErrors.provider;
    return gated;
  }, [touched, allErrors]);

  const isValid = useMemo(() => {
    if (!businessName.trim()) return false;
    if (!senderName.trim()) return false;
    if (!isValidEmail(senderEmail)) return false;
    if (!timezone) return false;
    if (!provider) return false;
    return true;
  }, [businessName, senderName, senderEmail, timezone, provider]);

  const handleSubmit = useCallback(async () => {
    // In resume mode only the provider needs validating — other fields are prefilled
    if (isResume) {
      if (!provider) {
        setTouched(ALL_TOUCHED);
        return;
      }
      setSubmitError(null);
      setIsSubmitting(true);

      try {
        const { oauthUrl } = await authorizeConnection.mutateAsync({
          businessId: resumeBusiness!.id,
          provider,
        });
        window.location.href = oauthUrl;
      } catch {
        setSubmitError(
          "Something went wrong setting up your business. Please try again.",
        );
        setIsSubmitting(false);
      }
      return;
    }

    // Mark all fields touched so errors surface on submit
    setTouched(ALL_TOUCHED);

    if (Object.keys(allErrors).length > 0) {
      return;
    }

    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const business = await createBusiness.mutateAsync({
        name: businessName.trim(),
        accountingProvider: provider!, // validated above
        senderName: senderName.trim(),
        senderEmail: senderEmail.trim(),
        timezone,
        ...(emailSignature.trim() ? { emailSignature: emailSignature.trim() } : {}),
      });

      const { oauthUrl } = await authorizeConnection.mutateAsync({
        businessId: business.id,
        provider: provider!,
      });

      window.location.href = oauthUrl;
    } catch {
      setSubmitError(
        "Something went wrong setting up your business. Please try again.",
      );
      setIsSubmitting(false);
    }
  }, [
    isResume,
    resumeBusiness,
    businessName,
    senderName,
    senderEmail,
    timezone,
    provider,
    emailSignature,
    allErrors,
    createBusiness,
    authorizeConnection,
  ]);

  return {
    // Form fields
    businessName,
    setBusinessName,
    senderName,
    setSenderName,
    senderEmail,
    setSenderEmail,
    timezone,
    setTimezone,
    emailSignature,
    setEmailSignature,
    // Provider
    provider,
    setProvider,
    // Signature toggle
    signatureOpen,
    toggleSignature,
    // Validation
    errors,
    isValid,
    markTouched,
    // Submit state
    isSubmitting,
    submitError,
    handleSubmit,
    // Data
    timezones: TIMEZONES,
    // Resume mode
    isResume,
    submitLabel,
  };
}
