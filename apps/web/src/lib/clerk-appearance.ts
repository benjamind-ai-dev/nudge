/**
 * Shared Clerk theming for <SignIn/> and <SignUp/>, tuned to the dark
 * "Midnight" canvas: indigo primary, near-white text, dark inputs, Geist font.
 * The `dark` baseTheme is applied at the call site (sign-in/sign-up) so this
 * exported object's inferred type stays portable.
 */
export const clerkAppearance = {
  variables: {
    colorPrimary: "#6366f1", // indigo-500 (matches --primary)
    colorText: "#e7e9ee",
    colorTextSecondary: "#94a0b8",
    colorBackground: "transparent",
    colorInputBackground: "#11141d",
    colorInputText: "#e7e9ee",
    colorDanger: "#f87171",
    borderRadius: "10px",
    fontFamily: '"Geist", ui-sans-serif, system-ui, sans-serif',
  },
  elements: {
    rootBox: "w-full",
    card: "shadow-none border-none p-0 bg-transparent w-full",
    header: "hidden",
    footer: "hidden",
    socialButtonsBlockButton:
      "border border-[#232838] rounded-md h-10 bg-[#11141d] hover:bg-[#1a1e2b]",
    socialButtonsBlockButtonText: "text-[#e7e9ee] font-medium",
    dividerLine: "bg-[#232838]",
    dividerText: "text-[#94a0b8]",
    formFieldLabel: "text-[#94a0b8] font-medium",
    formFieldInput:
      "border border-[#2a3043] bg-[#11141d] text-[#e7e9ee] rounded-md h-10 focus:border-[#6366f1] focus:ring-[#6366f1]",
    formButtonPrimary:
      "bg-[#6366f1] hover:bg-[#818cf8] text-white normal-case font-semibold shadow-sm",
    footerActionLink: "text-[#818cf8] hover:text-[#a5b4fc] font-semibold",
  },
};
