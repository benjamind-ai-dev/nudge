import { z } from "zod";

export const clerkEmailAddressSchema = z.object({
  id: z.string(),
  email_address: z.string().email(),
});

/** Metadata we set on outbound invitations and read back on accepted user.created. */
export const nudgeInvitationMetadataSchema = z.object({
  nudgeAccountId: z.string().uuid(),
  nudgeUserId: z.string().uuid(),
  nudgeRole: z.enum(["admin", "viewer"]),
});
export type NudgeInvitationMetadata = z.infer<typeof nudgeInvitationMetadataSchema>;

export const clerkUserCreatedDataSchema = z.object({
  id: z.string(),
  email_addresses: z.array(clerkEmailAddressSchema),
  primary_email_address_id: z.string().nullable(),
  first_name: z.string().nullable(),
  last_name: z.string().nullable(),
  // `public_metadata` is always present on user.created (empty `{}` for fresh
  // signups, populated for invitation acceptances). Accept any object shape;
  // the controller will parse it against `nudgeInvitationMetadataSchema`.
  public_metadata: z.record(z.string(), z.unknown()).optional().default({}),
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
