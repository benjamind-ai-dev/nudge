import { z } from "zod";

export const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().url().optional(),
  REDIS_HOST: z.string().default("localhost"),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_FAMILY: z.coerce.number().default(4),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .optional(),
  CORS_ALLOWED_ORIGINS: z.string().default("http://localhost:5173"),
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  RESEND_WEBHOOK_SECRET: z.string().min(1),
  CLERK_SECRET_KEY: z.string().min(1),
  CLERK_WEBHOOK_SECRET: z.string().min(1),
  TWILIO_WEBHOOK_SECRET: z.string().min(1),
  QUICKBOOKS_CLIENT_ID: z.string().min(1),
  QUICKBOOKS_CLIENT_SECRET: z.string().min(1),
  QUICKBOOKS_REDIRECT_URI: z.string().url(),
  QUICKBOOKS_ENVIRONMENT: z.enum(["sandbox", "production"]).default("sandbox"),
  QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN: z.string().min(1),
  XERO_CLIENT_ID: z.string().min(1),
  XERO_CLIENT_SECRET: z.string().min(1),
  XERO_REDIRECT_URI: z.string().url(),
  XERO_WEBHOOK_KEY: z.string().min(1).optional(),
  ENCRYPTION_KEY: z.string().length(64),
  FRONTEND_URL: z.string().url(),
});

export type Env = z.infer<typeof envSchema>;
