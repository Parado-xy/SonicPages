import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { playbackPreferenceSchema } from "@/lib/audio/validation";
import { prisma } from "@/lib/prisma";

export async function PUT(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user.id) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const parsed = playbackPreferenceSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid playback preferences." }, { status: 400 });
  const preference = await prisma.playbackPreference.upsert({ where: { userId: session.user.id }, create: { userId: session.user.id, ...parsed.data }, update: parsed.data });
  return NextResponse.json(preference);
}

