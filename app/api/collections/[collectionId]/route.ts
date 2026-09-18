import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ collectionId: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user.id) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { collectionId } = await context.params;
  const result = await prisma.collection.deleteMany({ where: { id: collectionId, userId: session.user.id } });
  if (!result.count) return NextResponse.json({ error: "Collection not found." }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
