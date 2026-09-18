import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const documentSchema = z.object({ documentId: z.string().min(1).max(64) });
type RouteContext = { params: Promise<{ collectionId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user.id) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { collectionId } = await context.params;
  const parsed = documentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid document." }, { status: 400 });

  const [collection, document] = await Promise.all([
    prisma.collection.findFirst({ where: { id: collectionId, userId: session.user.id }, select: { id: true } }),
    prisma.document.findFirst({ where: { id: parsed.data.documentId, ownerId: session.user.id }, select: { id: true } }),
  ]);
  if (!collection || !document) return NextResponse.json({ error: "Collection or document not found." }, { status: 404 });
  await prisma.collectionDocument.upsert({
    where: { collectionId_documentId: { collectionId, documentId: document.id } },
    create: { collectionId, documentId: document.id },
    update: {},
  });
  return NextResponse.json({ collectionId, documentId: document.id }, { status: 201 });
}

export async function DELETE(request: Request, context: RouteContext) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user.id) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { collectionId } = await context.params;
  const parsed = documentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid document." }, { status: 400 });
  await prisma.collectionDocument.deleteMany({
    where: {
      collectionId,
      documentId: parsed.data.documentId,
      collection: { userId: session.user.id },
      document: { ownerId: session.user.id },
    },
  });
  return new NextResponse(null, { status: 204 });
}
