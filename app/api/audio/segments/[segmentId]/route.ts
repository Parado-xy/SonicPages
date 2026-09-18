import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createDocumentDownload } from "@/lib/storage/s3";

type RouteContext = { params: Promise<{ segmentId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user.id) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { segmentId } = await context.params;
  const segment = await prisma.audioSegment.findFirst({ where: { id: segmentId, document: { ownerId: session.user.id } }, select: { storageKey: true } });
  if (!segment) return NextResponse.json({ error: "Audio segment not found." }, { status: 404 });
  return NextResponse.redirect(await createDocumentDownload(segment.storageKey), 307);
}

