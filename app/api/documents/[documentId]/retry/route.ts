import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ documentId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user.id) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { documentId } = await context.params;
  const document = await prisma.document.findFirst({
    where: { id: documentId, ownerId: session.user.id },
    include: { ingestionJob: true },
  });
  if (!document) return NextResponse.json({ error: "Document not found." }, { status: 404 });
  if (document.status !== "FAILED" || !document.ingestionJob) {
    return NextResponse.json({ error: "This document cannot be retried." }, { status: 409 });
  }

  await prisma.$transaction([
    prisma.document.update({
      where: { id: document.id },
      data: { status: "PROCESSING", failureReason: null },
    }),
    prisma.documentIngestionJob.update({
      where: { id: document.ingestionJob.id },
      data: {
        status: "QUEUED",
        attempts: 0,
        runAfter: new Date(),
        lockedAt: null,
        lastError: null,
        completedAt: null,
      },
    }),
  ]);

  return NextResponse.json({ documentId, status: "PROCESSING" });
}
