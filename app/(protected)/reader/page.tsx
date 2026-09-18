import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { findResumeDocument } from "@/lib/data/reader";

export const metadata = { title: "Reader" };

export default async function ReaderPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const resume = session?.user.id ? await findResumeDocument(session.user.id) : null;
  if (!resume) redirect("/library");
  redirect(`/reader/${resume.documentId}?section=${resume.sectionIndex ?? 0}` as never);
}
