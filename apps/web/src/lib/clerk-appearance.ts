/**
 * Shared Clerk theming so <SignUp/> and <SignIn/> match the Figma onboarding
 * form: accent-blue primary, 6px inputs, Geist font, white social button.
 */
export const clerkAppearance = {
  variables: {
    colorPrimary: "#2E75B6",
    colorText: "#041534",
    colorTextSecondary: "#45464E",
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
      "border border-[#C5C6CF] rounded-md h-10 hover:bg-gray-50",
    socialButtonsBlockButtonText: "text-[#1A1C1C] font-medium",
    dividerLine: "bg-[#C5C6CF]",
    dividerText: "text-[#45464E]",
    formFieldLabel: "text-[#45464E] font-medium",
    formFieldInput:
      "border border-[#C5C6CF] rounded-md h-10 focus:border-[#2E75B6] focus:ring-[#2E75B6]",
    formButtonPrimary:
      "bg-[#2E75B6] hover:bg-[#2666a0] text-white normal-case font-semibold shadow-sm",
    footerActionLink: "text-[#2E75B6] hover:text-[#2666a0] font-semibold",
  },
};
