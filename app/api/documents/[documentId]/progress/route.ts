import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { readingProgressSchema } from "@/lib/reader-validation";
type RouteContext = { params: Promise<{ documentId: string }> };

export async function PUT(request: Request, context: RouteContext) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user.id) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { documentId } = await context.params;
  const parsed = readingProgressSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid reading position." }, { status: 400 });

  const section = await prisma.documentSection.findFirst({
    where: { documentId, index: parsed.data.sectionIndex, document: { ownerId: session.user.id, status: "READY" } },
    select: { id: true },
  });
  if (!section) return NextResponse.json({ error: "Document section not found." }, { status: 404 });

  await prisma.readingProgress.upsert({
    where: { userId_documentId: { userId: session.user.id, documentId } },
    create: { userId: session.user.id, documentId, ...parsed.data },
    update: parsed.data,
  });
  return NextResponse.json({ documentId, ...parsed.data });
}
