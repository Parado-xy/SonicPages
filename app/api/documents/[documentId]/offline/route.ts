import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ documentId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user.id) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { documentId } = await context.params;
  const document = await prisma.document.findFirst({
    where: { id: documentId, ownerId: session.user.id, status: "READY" },
    select: {
      id: true, title: true, author: true, format: true,
      sections: { orderBy: { index: "asc" }, select: { id: true, index: true, title: true, text: true } },
      bookmarks: { where: { userId: session.user.id }, select: { id: true, sectionId: true, characterOffset: true, label: true } },
      highlights: { where: { userId: session.user.id }, select: { id: true, sectionId: true, startOffset: true, endOffset: true, selectedText: true, color: true } },
      notes: { where: { userId: session.user.id }, select: { id: true, sectionId: true, highlightId: true, content: true } },
    },
  });
  if (!document) return NextResponse.json({ error: "Ready document not found." }, { status: 404 });
  return NextResponse.json({ ...document, ownerId: session.user.id, savedAt: new Date().toISOString(), annotations: { bookmarks: document.bookmarks, highlights: document.highlights, notes: document.notes }, bookmarks: undefined, highlights: undefined, notes: undefined }, { headers: { "Cache-Control": "private, no-store" } });
}
