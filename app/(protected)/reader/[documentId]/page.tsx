import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { ReaderExperience } from "@/components/reader/reader-experience";
import { getOwnedReaderDocument } from "@/lib/data/reader";

type PageProps = {
  params: Promise<{ documentId: string }>;
  searchParams: Promise<{ section?: string | string[] }>;
};

export default async function DocumentReaderPage({ params, searchParams }: PageProps) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user.id) notFound();
  const { documentId } = await params;
  const rawSection = (await searchParams).section;
  const requestedIndex = Number.parseInt(Array.isArray(rawSection) ? rawSection[0] : rawSection ?? "-1", 10);
  const reader = await getOwnedReaderDocument(session.user.id, documentId, Number.isSafeInteger(requestedIndex) ? requestedIndex : -1);
  if (!reader) notFound();
  return <ReaderExperience {...reader} />;
}
