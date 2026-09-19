import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { createAnnotationSchema } from "@/lib/annotation-validation";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ documentId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user.id) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { documentId } = await context.params;
  const document = await prisma.document.findFirst({ where: { id: documentId, ownerId: session.user.id }, select: { id: true } });
  if (!document) return NextResponse.json({ error: "Document not found." }, { status: 404 });
  const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 200);
  const [bookmarks, highlights, notes] = await Promise.all([
    prisma.bookmark.findMany({ where: { userId: session.user.id, documentId, ...(query ? { label: { contains: query, mode: "insensitive" } } : {}) }, orderBy: { createdAt: "desc" } }),
    prisma.highlight.findMany({ where: { userId: session.user.id, documentId, ...(query ? { selectedText: { contains: query, mode: "insensitive" } } : {}) }, orderBy: { createdAt: "desc" } }),
    prisma.note.findMany({ where: { userId: session.user.id, documentId, ...(query ? { content: { contains: query, mode: "insensitive" } } : {}) }, orderBy: { updatedAt: "desc" } }),
  ]);
  return NextResponse.json({ bookmarks, highlights, notes });
}

export async function POST(request: Request, context: RouteContext) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user.id) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const parsed = createAnnotationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid annotation." }, { status: 400 });
  const { documentId } = await context.params;
  const section = await prisma.documentSection.findFirst({ where: { id: parsed.data.sectionId, documentId, document: { ownerId: session.user.id, status: "READY" } }, select: { id: true, text: true } });
  if (!section) return NextResponse.json({ error: "Document section not found." }, { status: 404 });

  if (parsed.data.clientId) {
    const existing = parsed.data.kind === "bookmark"
      ? await prisma.bookmark.findFirst({ where: { clientId: parsed.data.clientId, userId: session.user.id } })
      : parsed.data.kind === "highlight"
        ? await prisma.highlight.findFirst({ where: { clientId: parsed.data.clientId, userId: session.user.id } })
        : await prisma.note.findFirst({ where: { clientId: parsed.data.clientId, userId: session.user.id } });
    if (existing) return NextResponse.json({ kind: parsed.data.kind, annotation: existing });
  }

  if (parsed.data.kind === "bookmark") {
    if (parsed.data.characterOffset > section.text.length) return NextResponse.json({ error: "Bookmark position is outside this section." }, { status: 400 });
    const existing = await prisma.bookmark.findFirst({ where: { userId: session.user.id, documentId, sectionId: section.id, characterOffset: parsed.data.characterOffset } });
    if (existing) return NextResponse.json({ kind: "bookmark", annotation: existing });
    const bookmark = await prisma.bookmark.create({ data: { clientId: parsed.data.clientId, userId: session.user.id, documentId, sectionId: section.id, characterOffset: parsed.data.characterOffset, label: parsed.data.label } });
    return NextResponse.json({ kind: "bookmark", annotation: bookmark }, { status: 201 });
  }
  if (parsed.data.kind === "highlight") {
    if (parsed.data.endOffset <= parsed.data.startOffset || parsed.data.endOffset > section.text.length || section.text.slice(parsed.data.startOffset, parsed.data.endOffset) !== parsed.data.selectedText) {
      return NextResponse.json({ error: "The selected text no longer matches this document." }, { status: 409 });
    }
    const highlight = await prisma.highlight.create({ data: { clientId: parsed.data.clientId, userId: session.user.id, documentId, sectionId: section.id, startOffset: parsed.data.startOffset, endOffset: parsed.data.endOffset, selectedText: parsed.data.selectedText, color: parsed.data.color } });
    return NextResponse.json({ kind: "highlight", annotation: highlight }, { status: 201 });
  }
  if (parsed.data.highlightId) {
    const highlight = await prisma.highlight.findFirst({ where: { OR: [{ id: parsed.data.highlightId }, { clientId: parsed.data.highlightId }], userId: session.user.id, documentId, sectionId: section.id }, select: { id: true } });
    if (!highlight) return NextResponse.json({ error: "Highlight not found." }, { status: 404 });
    parsed.data.highlightId = highlight.id;
  }
  const note = await prisma.note.create({ data: { clientId: parsed.data.clientId, userId: session.user.id, documentId, sectionId: section.id, highlightId: parsed.data.highlightId, content: parsed.data.content } });
  return NextResponse.json({ kind: "note", annotation: note }, { status: 201 });
}
