import { z } from "zod";

export const businessIdQuerySchema = z.string().uuid();
export type BusinessIdQuery = z.infer<typeof businessIdQuerySchema>;

export const createTemplateSchema = z.object({
  businessId: z.string().uuid(),
  name: z.string().min(1).max(255),
  subject: z.string().nullable().optional(),
  body: z.string().min(1),
  signature: z.string().nullable().optional(),
  smsBody: z.string().nullable().optional(),
});

export type CreateTemplateDto = z.infer<typeof createTemplateSchema>;

export const updateTemplateSchema = z.object({
  businessId: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  subject: z.string().nullable().optional(),
  body: z.string().min(1).optional(),
  signature: z.string().nullable().optional(),
  smsBody: z.string().nullable().optional(),
});

export type UpdateTemplateDto = z.infer<typeof updateTemplateSchema>;

export const generateTemplateSchema = z.object({
  description: z.string().min(1).max(2000),
});

export type GenerateTemplateDto = z.infer<typeof generateTemplateSchema>;

export const attachTemplateSchema = z.object({
  businessId: z.string().uuid(),
  templateId: z.string().uuid(),
});

export type AttachTemplateDto = z.infer<typeof attachTemplateSchema>;
