import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { AudioLimitError, enqueueAudioGeneration, getOwnedAudioState } from "@/lib/audio/jobs";
import { audioGenerationSchema } from "@/lib/audio/validation";

type RouteContext = { params: Promise<{ documentId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user.id) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { documentId } = await context.params;
  const job = await getOwnedAudioState(session.user.id, documentId);
  return NextResponse.json({ job: serializeJob(job) });
}

export async function POST(request: Request, context: RouteContext) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user.id) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const parsed = audioGenerationSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Choose a supported voice." }, { status: 400 });
  const { documentId } = await context.params;
  try {
    const job = await enqueueAudioGeneration(session.user.id, documentId, parsed.data.voiceId);
    if (!job) return NextResponse.json({ error: "Ready document not found." }, { status: 404 });
    return NextResponse.json({ job: serializeJob(job) }, { status: job.status === "COMPLETED" ? 200 : 202 });
  } catch (error) {
    if (error instanceof AudioLimitError) return NextResponse.json({ error: error.message }, { status: 429 });
    if (error instanceof Error && error.name === "ZodError") return NextResponse.json({ error: "Audio generation is not configured." }, { status: 503 });
    throw error;
  }
}

function serializeJob(job: Awaited<ReturnType<typeof getOwnedAudioState>> | null) {
  if (!job) return null;
  return { ...job, segments: job.segments.map((segment) => ({ ...segment, url: `/api/audio/segments/${segment.id}` })) };
}

