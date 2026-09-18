import { randomUUID } from "node:crypto";

import { Prisma } from "@prisma/client";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parseStorageEnvironment } from "@/lib/storage/config";
import { createDocumentUpload } from "@/lib/storage/s3";
import {
  documentTitle,
  storageKeyFor,
  UPLOAD_TTL_SECONDS,
  validateUploadRequest,
} from "@/lib/uploads";

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user.id) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  try {
    const environment = parseStorageEnvironment(process.env);
    const input = validateUploadRequest(await request.json(), environment.MAX_DOCUMENT_BYTES);
    const documentId = randomUUID();
    const uploadId = randomUUID();
    const storageKey = storageKeyFor(session.user.id, documentId, input.extension);
    const expiresAt = new Date(Date.now() + UPLOAD_TTL_SECONDS * 1000);

    await prisma.$transaction(
      async (transaction) => {
        const usage = await transaction.document.aggregate({
          where: {
            ownerId: session.user.id,
            status: { not: "ARCHIVED" },
            OR: [
              { upload: null },
              { upload: { is: { status: "COMPLETED" } } },
              { upload: { is: { status: "PENDING", expiresAt: { gt: new Date() } } } },
            ],
          },
          _sum: { sizeBytes: true },
        });
        const projectedUsage = (usage._sum.sizeBytes ?? BigInt(0)) + BigInt(input.sizeBytes);
        if (projectedUsage > BigInt(environment.USER_STORAGE_QUOTA_BYTES)) {
          throw new UploadQuotaError();
        }

        await transaction.document.create({
          data: {
            id: documentId,
            ownerId: session.user.id,
            title: documentTitle(input.filename),
            format: input.format,
            originalFilename: input.filename,
            mimeType: input.contentType,
            sizeBytes: input.sizeBytes,
            upload: {
              create: {
                id: uploadId,
                ownerId: session.user.id,
                storageKey,
                originalFilename: input.filename,
                contentType: input.contentType,
                sizeBytes: input.sizeBytes,
                expiresAt,
              },
            },
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    try {
      const upload = await createDocumentUpload(
        storageKey,
        input.contentType,
        environment.MAX_DOCUMENT_BYTES,
      );
      return NextResponse.json({
        documentId,
        uploadId,
        upload,
        expiresAt: expiresAt.toISOString(),
      });
    } catch (error) {
      await prisma.document.deleteMany({ where: { id: documentId, ownerId: session.user.id } });
      throw error;
    }
  } catch (error) {
    if (error instanceof UploadQuotaError) {
      return NextResponse.json({ error: "Your storage quota would be exceeded." }, { status: 413 });
    }
    if (error instanceof ZodError || error instanceof SyntaxError || error instanceof Error && error.message.startsWith("The file")) {
      return NextResponse.json(
        { error: error instanceof ZodError ? "Invalid upload request." : error.message },
        { status: 400 },
      );
    }
    console.error("Unable to create document upload", error);
    return NextResponse.json({ error: "Unable to prepare the upload." }, { status: 500 });
  }
}

class UploadQuotaError extends Error {}
