import { z } from "zod";

const optionalUrl = z.preprocess((value) => value || undefined, z.string().url().optional());

const storageEnvironmentSchema = z.object({
  S3_BUCKET: z.string().min(1),
  S3_REGION: z.string().min(1).default("us-east-1"),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_ENDPOINT: optionalUrl,
  S3_FORCE_PATH_STYLE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  MAX_DOCUMENT_BYTES: z.coerce.number().int().positive().default(50 * 1024 * 1024),
  USER_STORAGE_QUOTA_BYTES: z.coerce.number().int().positive().default(500 * 1024 * 1024),
});

export type StorageEnvironment = z.infer<typeof storageEnvironmentSchema>;

export function parseStorageEnvironment(environment: Record<string, string | undefined>) {
  return storageEnvironmentSchema.parse(environment);
}
