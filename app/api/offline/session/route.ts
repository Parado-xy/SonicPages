import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/auth";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user.id) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  return NextResponse.json({ userId: session.user.id }, { headers: { "Cache-Control": "private, no-store" } });
}
