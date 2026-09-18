import { z } from "zod";

const serverEnvironmentSchema = z.object({
  DATABASE_URL: z.string().url().startsWith("postgresql://"),
  AUTH_SECRET: z.string().min(32),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  AUTH_GOOGLE_ID: z.string().min(1).optional(),
  AUTH_GOOGLE_SECRET: z.string().min(1).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().email().optional(),
});

export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>;

type EnvironmentInput = Record<string, string | undefined>;

export function parseServerEnvironment(environment: EnvironmentInput): ServerEnvironment {
  return serverEnvironmentSchema.superRefine((value, context) => {
    const googleConfigured = Boolean(value.AUTH_GOOGLE_ID || value.AUTH_GOOGLE_SECRET);
    if (googleConfigured && !(value.AUTH_GOOGLE_ID && value.AUTH_GOOGLE_SECRET)) {
      context.addIssue({
        code: "custom",
        message: "AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET must be configured together.",
        path: ["AUTH_GOOGLE_ID"],
      });
    }

    const emailConfigured = Boolean(value.RESEND_API_KEY || value.EMAIL_FROM);
    if (emailConfigured && !(value.RESEND_API_KEY && value.EMAIL_FROM)) {
      context.addIssue({
        code: "custom",
        message: "RESEND_API_KEY and EMAIL_FROM must be configured together.",
        path: ["RESEND_API_KEY"],
      });
    }
  }).parse(environment);
}

export function getAuthCapabilities(environment: EnvironmentInput = process.env) {
  return {
    google: Boolean(environment.AUTH_GOOGLE_ID && environment.AUTH_GOOGLE_SECRET),
    email: Boolean(environment.RESEND_API_KEY && environment.EMAIL_FROM),
  };
}
