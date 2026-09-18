import { DocumentFormat, DocumentStatus } from "@prisma/client";

export const librarySorts = ["recent", "oldest", "title", "size"] as const;
export const libraryViews = ["grid", "list"] as const;

export type LibraryQuery = ReturnType<typeof parseLibraryQuery>;

type SearchParams = Record<string, string | string[] | undefined>;

export function parseLibraryQuery(params: SearchParams) {
  const q = value(params.q).trim().slice(0, 100);
  const formatValue = value(params.format).toUpperCase();
  const statusValue = value(params.status).toUpperCase();
  const sortValue = value(params.sort);
  const viewValue = value(params.view);
  const requestedPage = Number.parseInt(value(params.page), 10);

  return {
    q,
    format: Object.values(DocumentFormat).includes(formatValue as DocumentFormat)
      ? (formatValue as DocumentFormat)
      : undefined,
    status: Object.values(DocumentStatus).includes(statusValue as DocumentStatus)
      ? (statusValue as DocumentStatus)
      : undefined,
    sort: librarySorts.includes(sortValue as (typeof librarySorts)[number])
      ? (sortValue as (typeof librarySorts)[number])
      : "recent",
    view: libraryViews.includes(viewValue as (typeof libraryViews)[number])
      ? (viewValue as (typeof libraryViews)[number])
      : "grid",
    collectionId: value(params.collection).slice(0, 64) || undefined,
    page: Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1,
    pageSize: 24,
  };
}

function value(input: string | string[] | undefined) {
  return typeof input === "string" ? input : input?.[0] ?? "";
}
