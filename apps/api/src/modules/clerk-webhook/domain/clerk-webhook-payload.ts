import { z } from "zod";

export const clerkEmailAddressSchema = z.object({
  id: z.string(),
  email_address: z.string().email(),
});

export const clerkUserCreatedDataSchema = z.object({
  id: z.string(),
  email_addresses: z.array(clerkEmailAddressSchema),
  primary_email_address_id: z.string().nullable(),
  first_name: z.string().nullable(),
  last_name: z.string().nullable(),
});

export const clerkWebhookEventSchema = z.object({
  type: z.string(),
  data: z.unknown(),
});

export type ClerkEmailAddress = z.infer<typeof clerkEmailAddressSchema>;
export type ClerkUserCreatedData = z.infer<typeof clerkUserCreatedDataSchema>;

export interface ClerkUserCreatedEvent {
  type: "user.created";
  data: ClerkUserCreatedData;
}

export type ClerkWebhookEvent = ClerkUserCreatedEvent | { type: string; data: unknown };
