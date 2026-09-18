import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import {
  deleteOwnedDocument,
  findOwnedDocumentForDeletion,
  renameOwnedDocument,
} from "@/lib/data/documents";
import { deleteStoredObjects } from "@/lib/storage/s3";

const renameSchema = z.object({ title: z.string().trim().min(1).max(160) });
type RouteContext = { params: Promise<{ documentId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user.id) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { documentId } = await context.params;
  const parsed = renameSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a title between 1 and 160 characters." }, { status: 400 });

  const result = await renameOwnedDocument(session.user.id, documentId, parsed.data.title);
  if (!result.count) return NextResponse.json({ error: "Document not found." }, { status: 404 });
  return NextResponse.json({ documentId, title: parsed.data.title });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user.id) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { documentId } = await context.params;
  const document = await findOwnedDocumentForDeletion(session.user.id, documentId);
  if (!document) return NextResponse.json({ error: "Document not found." }, { status: 404 });

  try {
    await deleteStoredObjects([
      ...document.assets.map((asset) => asset.storageKey),
      ...document.audioSegments.map((segment) => segment.storageKey),
    ]);
    await deleteOwnedDocument(session.user.id, document.id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Unable to delete document", { documentId, error });
    return NextResponse.json({ error: "The document could not be deleted safely." }, { status: 502 });
  }
}
