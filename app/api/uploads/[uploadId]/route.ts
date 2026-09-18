import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { deleteStoredObject } from "@/lib/storage/s3";

type RouteContext = { params: Promise<{ uploadId: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
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
    return NextResponse.json({ error: "Completed uploads cannot be cancelled." }, { status: 409 });
  }

  await deleteStoredObject(upload.storageKey).catch(() => undefined);
  await prisma.document.deleteMany({
    where: { id: upload.documentId, ownerId: session.user.id },
  });
  return new NextResponse(null, { status: 204 });
}
