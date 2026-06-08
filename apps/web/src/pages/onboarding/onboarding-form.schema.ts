import { z } from "zod";

export const onboardingFormSchema = z.object({
  businessName: z
    .string()
    .trim()
    .min(1, "Enter your business name."),
  senderName: z
    .string()
    .trim()
    .min(1, "Enter a sender name."),
  senderEmail: z
    .string()
    .trim()
    .email("Enter a valid email address."),
  timezone: z
    .string()
    .min(1, "Select a timezone."),
  provider: z
    .enum(["quickbooks", "xero"])
    .nullable()
    .refine((val): val is "quickbooks" | "xero" => val !== null, {
      message: "Select an accounting provider.",
    }),
  emailSignature: z.string().optional(),
});

export type OnboardingFormValues = z.infer<typeof onboardingFormSchema>;
