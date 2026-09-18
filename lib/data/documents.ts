import type { Prisma } from "@prisma/client";

import type { LibraryQuery } from "@/lib/library-query";
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

export async function listOwnedDocuments(userId: string, query: LibraryQuery) {
  const where: Prisma.DocumentWhereInput = {
    ownerId: userId,
    AND: [
      { OR: [{ upload: null }, { upload: { is: { status: "COMPLETED" } } }] },
      ...(query.q
        ? [{
            OR: [
              { title: { contains: query.q, mode: "insensitive" as const } },
              { author: { contains: query.q, mode: "insensitive" as const } },
              { originalFilename: { contains: query.q, mode: "insensitive" as const } },
            ],
          }]
        : []),
    ],
    format: query.format,
    status: query.status,
    collections: query.collectionId
      ? { some: { collectionId: query.collectionId, collection: { userId } } }
      : undefined,
  };
  const orderBy: Prisma.DocumentOrderByWithRelationInput =
    query.sort === "title" ? { title: "asc" }
      : query.sort === "oldest" ? { createdAt: "asc" }
        : query.sort === "size" ? { sizeBytes: "desc" }
          : { updatedAt: "desc" };

  const [documents, total] = await prisma.$transaction([
    prisma.document.findMany({
      where,
      orderBy,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: {
        assets: { where: { kind: "COVER" }, take: 1 },
        readingProgress: { where: { userId }, take: 1 },
        collections: { include: { collection: true } },
        _count: { select: { sections: true } },
      },
    }),
    prisma.document.count({ where }),
  ]);
  return { documents, total };
}

export function listOwnedCollections(userId: string) {
  return prisma.collection.findMany({
    where: { userId },
    orderBy: { name: "asc" },
    include: { _count: { select: { documents: true } } },
  });
}

export function findOwnedDocumentForDeletion(userId: string, documentId: string) {
  return prisma.document.findFirst({
    where: { id: documentId, ownerId: userId },
    include: {
      assets: { select: { storageKey: true } },
      audioSegments: { select: { storageKey: true } },
    },
  });
}

export function renameOwnedDocument(userId: string, documentId: string, title: string) {
  return prisma.document.updateMany({
    where: { id: documentId, ownerId: userId },
    data: { title },
  });
}

export function deleteOwnedDocument(userId: string, documentId: string) {
  return prisma.document.deleteMany({
    where: { id: documentId, ownerId: userId },
  });
}
