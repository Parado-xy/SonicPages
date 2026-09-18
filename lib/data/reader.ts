import { prisma } from "@/lib/prisma";

export const defaultReaderPreference = {
  fontFamily: "serif",
  fontSize: 19,
  lineHeight: 1.8,
  contentWidth: 720,
  theme: "paper",
};

export async function getOwnedReaderDocument(userId: string, documentId: string, requestedIndex: number) {
  const document = await prisma.document.findFirst({
    where: { id: documentId, ownerId: userId, status: "READY" },
    select: {
      id: true,
      title: true,
      author: true,
      format: true,
      sections: {
        orderBy: { index: "asc" },
        select: { id: true, index: true, title: true, pageStart: true, pageEnd: true },
      },
      readingProgress: {
        where: { userId },
        take: 1,
        select: { sectionIndex: true, characterOffset: true, percent: true },
      },
    },
  });
  if (!document || !document.sections.length) return null;

  const savedIndex = document.readingProgress[0]?.sectionIndex ?? 0;
  const sectionIndex = document.sections.some((section) => section.index === requestedIndex)
    ? requestedIndex
    : document.sections.some((section) => section.index === savedIndex) ? savedIndex : document.sections[0].index;
  const section = await prisma.documentSection.findFirst({
    where: { documentId, index: sectionIndex, document: { ownerId: userId } },
    select: { id: true, index: true, title: true, text: true, pageStart: true, pageEnd: true },
  });
  const preference = await prisma.readerPreference.findUnique({ where: { userId } });
  if (!section) return null;

  return {
    document: { id: document.id, title: document.title, author: document.author, format: document.format },
    sections: document.sections,
    section,
    progress: document.readingProgress[0] ?? { sectionIndex: 0, characterOffset: 0, percent: 0 },
    preference: preference ?? defaultReaderPreference,
  };
}

export async function findResumeDocument(userId: string) {
  const progress = await prisma.readingProgress.findFirst({
    where: { userId, document: { status: "READY", ownerId: userId } },
    orderBy: { updatedAt: "desc" },
    select: { documentId: true, sectionIndex: true },
  });
  if (progress) return progress;
  return prisma.document.findFirst({
    where: { ownerId: userId, status: "READY", sections: { some: {} } },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  }).then((document) => document ? { documentId: document.id, sectionIndex: 0 } : null);
}
