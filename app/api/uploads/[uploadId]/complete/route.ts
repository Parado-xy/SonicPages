import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  deleteStoredObject,
  inspectStoredObject,
  readStoredObjectPrefix,
} from "@/lib/storage/s3";
import { hasExpectedFileSignature } from "@/lib/uploads";

type RouteContext = { params: Promise<{ uploadId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user.id) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { uploadId } = await context.params;
  const upload = await prisma.documentUpload.findFirst({
    where: { id: uploadId, ownerId: session.user.id },
  });
  if (!upload) return NextResponse.json({ error: "Upload not found." }, { status: 404 });
  if (upload.status === "COMPLETED") {
    return NextResponse.json({ documentId: upload.documentId, status: "PENDING" });
  }
  if (upload.status !== "PENDING" || upload.expiresAt < new Date()) {
    return NextResponse.json({ error: "This upload has expired." }, { status: 410 });
  }

  try {
    const object = await inspectStoredObject(upload.storageKey);
    const prefix = await readStoredObjectPrefix(upload.storageKey);
    const sizeMatches = BigInt(object.ContentLength ?? -1) === upload.sizeBytes;
    const typeMatches = object.ContentType === upload.contentType;
    const signatureMatches = hasExpectedFileSignature(upload.contentType, prefix);
    if (!sizeMatches || !typeMatches || !signatureMatches) {
      await deleteStoredObject(upload.storageKey);
      await prisma.$transaction([
        prisma.documentUpload.update({ where: { id: upload.id }, data: { status: "ABORTED" } }),
        prisma.document.update({
          where: { id: upload.documentId },
          data: { status: "FAILED", failureReason: "Uploaded object did not match its reservation." },
        }),
      ]);
      return NextResponse.json({ error: "The uploaded file failed verification." }, { status: 422 });
    }

    await prisma.$transaction([
      prisma.documentAsset.create({
        data: {
          documentId: upload.documentId,
          kind: "ORIGINAL",
          storageKey: upload.storageKey,
          contentType: upload.contentType,
          byteSize: upload.sizeBytes,
          checksum: object.ETag?.replaceAll('"', ""),
        },
      }),
      prisma.documentUpload.update({
        where: { id: upload.id },
        data: { status: "COMPLETED", completedAt: new Date() },
      }),
    ]);

    return NextResponse.json({ documentId: upload.documentId, status: "PENDING" });
  } catch (error) {
    console.error("Unable to verify document upload", error);
    return NextResponse.json({ error: "Unable to verify the upload." }, { status: 500 });
  }
}
