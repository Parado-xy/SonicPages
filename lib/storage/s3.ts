import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { parseStorageEnvironment } from "@/lib/storage/config";
import { UPLOAD_TTL_SECONDS } from "@/lib/uploads";

function createClient() {
  const environment = parseStorageEnvironment(process.env);
  return {
    environment,
    client: new S3Client({
      region: environment.S3_REGION,
      endpoint: environment.S3_ENDPOINT,
      forcePathStyle: environment.S3_FORCE_PATH_STYLE,
      credentials: {
        accessKeyId: environment.S3_ACCESS_KEY_ID,
        secretAccessKey: environment.S3_SECRET_ACCESS_KEY,
      },
    }),
  };
}

export async function createDocumentUpload(key: string, contentType: string, maxBytes: number) {
  const { client, environment } = createClient();
  return createPresignedPost(client, {
    Bucket: environment.S3_BUCKET,
    Key: key,
    Expires: UPLOAD_TTL_SECONDS,
    Fields: { "Content-Type": contentType },
    Conditions: [
      ["eq", "$key", key],
      ["eq", "$Content-Type", contentType],
      ["content-length-range", 1, maxBytes + 1024 * 1024],
    ],
  });
}

export async function inspectStoredObject(key: string) {
  const { client, environment } = createClient();
  return client.send(new HeadObjectCommand({ Bucket: environment.S3_BUCKET, Key: key }));
}

export async function readStoredObjectPrefix(key: string) {
  const { client, environment } = createClient();
  const response = await client.send(
    new GetObjectCommand({ Bucket: environment.S3_BUCKET, Key: key, Range: "bytes=0-4095" }),
  );
  return response.Body?.transformToByteArray() ?? new Uint8Array();
}

export async function deleteStoredObject(key: string) {
  const { client, environment } = createClient();
  await client.send(new DeleteObjectCommand({ Bucket: environment.S3_BUCKET, Key: key }));
}

export async function createDocumentDownload(key: string) {
  const { client, environment } = createClient();
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: environment.S3_BUCKET, Key: key }),
    { expiresIn: 5 * 60 },
  );
}
