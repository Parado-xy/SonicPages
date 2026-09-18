import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { findOwnedDocument } from "@/lib/data/documents";
import { createDocumentDownload } from "@/lib/storage/s3";

type RouteContext = { params: Promise<{ documentId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user.id) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { documentId } = await context.params;
  const document = await findOwnedDocument(session.user.id, documentId);
  const original = document?.assets.find((asset) => asset.kind === "ORIGINAL");
  if (!document || !original) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  const url = await createDocumentDownload(original.storageKey);
  return NextResponse.json({ url, expiresIn: 300 });
}
