/**
 * Shared Clerk theming so <SignUp/> and <SignIn/> match the Figma onboarding
 * form: accent-blue primary, 6px inputs, Geist font, white social button.
 *
 * TODO: dark Clerk appearance — install @clerk/themes and pass
 * `appearance={{ baseTheme: dark }}` to <SignIn> and <SignUp> so the widget
 * matches the Midnight canvas. The colorBackground/colorText below are still
 * light-mode values.
 */
export const clerkAppearance = {
  variables: {
    colorPrimary: "#2563EB",
    colorText: "#041534",
    colorTextSecondary: "#64748B",
    colorBackground: "#FFFFFF",
    colorInputBackground: "#FFFFFF",
    colorInputText: "#041534",
    colorDanger: "#DC2626",
    borderRadius: "6px",
    fontFamily: '"Geist", ui-sans-serif, system-ui, sans-serif',
  },
  elements: {
    rootBox: "w-full",
    card: "shadow-none border-none p-0 bg-transparent w-full",
    header: "hidden",
    footer: "hidden",
    socialButtonsBlockButton:
      "border border-[#E2E8F0] rounded-md h-10 hover:bg-gray-50",
    socialButtonsBlockButtonText: "text-[#0F172A] font-medium",
    dividerLine: "bg-[#E2E8F0]",
    dividerText: "text-[#64748B]",
    formFieldLabel: "text-[#64748B] font-medium",
    formFieldInput:
      "border border-[#E2E8F0] rounded-md h-10 focus:border-[#2563EB] focus:ring-[#2563EB]",
    formButtonPrimary:
      "bg-[#2563EB] hover:bg-[#1D4ED8] text-white normal-case font-semibold shadow-sm",
    footerActionLink: "text-[#2563EB] hover:text-[#1D4ED8] font-semibold",
  },
};
