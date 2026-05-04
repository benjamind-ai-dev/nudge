import { z } from "zod";

const channelSchema = z.enum(["email", "sms", "email_and_sms"]);

export const businessIdQuerySchema = z.string().uuid();
export type BusinessIdQuery = z.infer<typeof businessIdQuerySchema>;

export const createSequenceSchema = z.object({
  businessId: z.string().uuid(),
  name: z.string().min(1).max(255),
});
export type CreateSequenceDto = z.infer<typeof createSequenceSchema>;

export const updateSequenceSchema = z.object({
  businessId: z.string().uuid(),
  name: z.string().min(1).max(255),
});
export type UpdateSequenceDto = z.infer<typeof updateSequenceSchema>;

export const addStepSchema = z.object({
  stepOrder: z.number().int().min(1),
  delayDays: z.number().int().min(0),
  channel: channelSchema,
  subjectTemplate: z.string().nullable().optional(),
  bodyTemplate: z.string().min(1),
  smsBodyTemplate: z.string().nullable().optional(),
  isOwnerAlert: z.boolean().optional(),
});
export type AddStepDto = z.infer<typeof addStepSchema>;

export const updateStepSchema = z.object({
  stepOrder: z.number().int().min(1).optional(),
  delayDays: z.number().int().min(0).optional(),
  channel: channelSchema.optional(),
  subjectTemplate: z.string().nullable().optional(),
  bodyTemplate: z.string().min(1).optional(),
  smsBodyTemplate: z.string().nullable().optional(),
  isOwnerAlert: z.boolean().optional(),
});
export type UpdateStepDto = z.infer<typeof updateStepSchema>;

export const reorderStepsSchema = z.object({
  steps: z.array(z.object({ stepId: z.string().uuid(), stepOrder: z.number().int().min(1) })),
});
export type ReorderStepsDto = z.infer<typeof reorderStepsSchema>;
