import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { annotationKindSchema, updateAnnotationSchema } from "@/lib/annotation-validation";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ kind: string; annotationId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user.id) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const params = await context.params;
  const kind = annotationKindSchema.safeParse(params.kind);
  const body = updateAnnotationSchema.safeParse(await request.json().catch(() => null));
  if (!kind.success || !body.success || kind.data !== body.data.kind) return NextResponse.json({ error: "Invalid annotation update." }, { status: 400 });
  const result = body.data.kind === "bookmark"
    ? await prisma.bookmark.updateMany({ where: { OR: [{ id: params.annotationId }, { clientId: params.annotationId }], userId: session.user.id }, data: { label: body.data.label } })
    : body.data.kind === "highlight"
      ? await prisma.highlight.updateMany({ where: { OR: [{ id: params.annotationId }, { clientId: params.annotationId }], userId: session.user.id }, data: { color: body.data.color } })
      : await prisma.note.updateMany({ where: { OR: [{ id: params.annotationId }, { clientId: params.annotationId }], userId: session.user.id }, data: { content: body.data.content } });
  if (!result.count) return NextResponse.json({ error: "Annotation not found." }, { status: 404 });
  return NextResponse.json({ updated: true });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user.id) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const params = await context.params;
  const kind = annotationKindSchema.safeParse(params.kind);
  if (!kind.success) return NextResponse.json({ error: "Invalid annotation type." }, { status: 400 });
  const result = kind.data === "bookmark"
    ? await prisma.bookmark.deleteMany({ where: { OR: [{ id: params.annotationId }, { clientId: params.annotationId }], userId: session.user.id } })
    : kind.data === "highlight"
      ? await prisma.highlight.deleteMany({ where: { OR: [{ id: params.annotationId }, { clientId: params.annotationId }], userId: session.user.id } })
      : await prisma.note.deleteMany({ where: { OR: [{ id: params.annotationId }, { clientId: params.annotationId }], userId: session.user.id } });
  if (!result.count) return NextResponse.json({ error: "Annotation not found." }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
