import { prisma } from "@/lib/prisma";
import { getOwnedAudioState } from "@/lib/audio/jobs";

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
  const [preference, playbackPreference, audioJob, bookmarks, highlights, notes] = await Promise.all([
    prisma.readerPreference.findUnique({ where: { userId } }),
    prisma.playbackPreference.findUnique({ where: { userId } }),
    getOwnedAudioState(userId, documentId),
    prisma.bookmark.findMany({ where: { userId, documentId }, orderBy: { createdAt: "desc" } }),
    prisma.highlight.findMany({ where: { userId, documentId }, orderBy: { createdAt: "desc" } }),
    prisma.note.findMany({ where: { userId, documentId }, orderBy: { updatedAt: "desc" } }),
  ]);
  if (!section) return null;

  return {
    offlineOwnerId: userId,
    document: { id: document.id, title: document.title, author: document.author, format: document.format },
    sections: document.sections,
    section,
    progress: document.readingProgress[0] ?? { sectionIndex: 0, characterOffset: 0, percent: 0 },
    preference: preference ?? defaultReaderPreference,
    playbackPreference: playbackPreference ?? { provider: "openai", voiceId: "coral", rate: 1, pitch: 1, autoAdvance: true },
    audioJob: audioJob ? {
      id: audioJob.id,
      status: audioJob.status,
      voiceId: audioJob.voiceId,
      errorMessage: audioJob.errorMessage,
      segments: audioJob.segments.map((segment) => ({ ...segment, url: `/api/audio/segments/${segment.id}` })),
    } : null,
    annotations: {
      bookmarks: bookmarks.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })),
      highlights: highlights.map((item) => ({ ...item, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString() })),
      notes: notes.map((item) => ({ ...item, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString() })),
    },
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
