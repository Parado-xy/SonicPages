import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ documentId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user.id) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { documentId } = await context.params;
  const document = await prisma.document.findFirst({
    where: { id: documentId, ownerId: session.user.id },
    select: { title: true, author: true, bookmarks: { where: { userId: session.user.id }, include: { section: { select: { index: true, title: true } } }, orderBy: { createdAt: "asc" } }, highlights: { where: { userId: session.user.id }, include: { section: { select: { index: true, title: true } } }, orderBy: { createdAt: "asc" } }, notes: { where: { userId: session.user.id }, include: { section: { select: { index: true, title: true } }, highlight: { select: { selectedText: true } } }, orderBy: { createdAt: "asc" } } },
  });
  if (!document) return NextResponse.json({ error: "Document not found." }, { status: 404 });
  const format = new URL(request.url).searchParams.get("format") === "json" ? "json" : "markdown";
  const filename = `${document.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 80) || "document"}-annotations.${format === "json" ? "json" : "md"}`;
  const content = format === "json" ? JSON.stringify(document, null, 2) : toMarkdown(document);
  return new NextResponse(content, { headers: { "Content-Type": format === "json" ? "application/json; charset=utf-8" : "text/markdown; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "private, no-store" } });
}

function toMarkdown(document: { title: string; author: string | null; bookmarks: Array<{ label: string | null; characterOffset: number; section: { index: number; title: string | null } | null }>; highlights: Array<{ selectedText: string; color: string; section: { index: number; title: string | null } | null }>; notes: Array<{ content: string; highlight: { selectedText: string } | null; section: { index: number; title: string | null } | null }> }) {
  const location = (section: { index: number; title: string | null } | null) => section ? section.title || `Section ${section.index + 1}` : "Document";
  const lines = [`# ${document.title}`, document.author ? `By ${document.author}` : "", "", "## Bookmarks", ...document.bookmarks.map((item) => `- **${location(item.section)}**${item.label ? `: ${item.label}` : ""} (character ${item.characterOffset})`), "", "## Highlights", ...document.highlights.map((item) => `> ${item.selectedText.replace(/\n/g, "\n> ")}\n>\n> _${location(item.section)} · ${item.color}_`), "", "## Notes", ...document.notes.map((item) => `### ${location(item.section)}\n${item.highlight ? `> ${item.highlight.selectedText.replace(/\n/g, "\n> ")}\n\n` : ""}${item.content}`)];
  return lines.filter((line, index) => line || index > 1).join("\n\n");
}
