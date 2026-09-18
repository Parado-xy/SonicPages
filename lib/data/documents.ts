import { prisma } from "@/lib/prisma";

export function findOwnedDocument(userId: string, documentId: string) {
  return prisma.document.findFirst({
    where: { id: documentId, ownerId: userId },
    include: {
      assets: true,
      readingProgress: { where: { userId } },
    },
  });
}

export function listOwnedDocuments(userId: string) {
  return prisma.document.findMany({
    where: { ownerId: userId },
    orderBy: { updatedAt: "desc" },
    include: {
      assets: { where: { kind: "COVER" }, take: 1 },
      readingProgress: { where: { userId }, take: 1 },
    },
  });
}

export function deleteOwnedDocument(userId: string, documentId: string) {
  return prisma.document.deleteMany({
    where: { id: documentId, ownerId: userId },
  });
}
