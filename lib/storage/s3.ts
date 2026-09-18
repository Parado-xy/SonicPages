import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
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

export async function downloadStoredObject(key: string) {
  const { client, environment } = createClient();
  const response = await client.send(
    new GetObjectCommand({ Bucket: environment.S3_BUCKET, Key: key }),
  );
  if (!response.Body) throw new Error("The stored document is empty.");
  return response.Body.transformToByteArray();
}

export async function deleteStoredObject(key: string) {
  const { client, environment } = createClient();
  await client.send(new DeleteObjectCommand({ Bucket: environment.S3_BUCKET, Key: key }));
}

export async function deleteStoredObjects(keys: string[]) {
  if (!keys.length) return;
  const { client, environment } = createClient();
  for (let index = 0; index < keys.length; index += 1_000) {
    const response = await client.send(
      new DeleteObjectsCommand({
        Bucket: environment.S3_BUCKET,
        Delete: { Objects: keys.slice(index, index + 1_000).map((Key) => ({ Key })), Quiet: true },
      }),
    );
    if (response.Errors?.length) throw new Error("One or more stored assets could not be deleted.");
  }
}

export async function createDocumentDownload(key: string) {
  const { client, environment } = createClient();
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: environment.S3_BUCKET, Key: key }),
    { expiresIn: 5 * 60 },
  );
}

export async function storeGeneratedAudio(key: string, bytes: Uint8Array, contentType: string) {
  const { client, environment } = createClient();
  await client.send(new PutObjectCommand({
    Bucket: environment.S3_BUCKET,
    Key: key,
    Body: bytes,
    ContentType: contentType,
    CacheControl: "private, max-age=31536000, immutable",
  }));
}
