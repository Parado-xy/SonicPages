import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const collectionSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(240).optional(),
});

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user.id) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const parsed = collectionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid collection name." }, { status: 400 });

  try {
    const collection = await prisma.collection.create({
      data: { userId: session.user.id, ...parsed.data },
    });
    return NextResponse.json(collection, { status: 201 });
  } catch {
    return NextResponse.json({ error: "A collection with this name already exists." }, { status: 409 });
  }
}
