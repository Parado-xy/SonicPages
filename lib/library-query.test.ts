import { describe, expect, it } from "vitest";

import { parseLibraryQuery } from "@/lib/library-query";

describe("library query", () => {
  it("normalizes supported filters", () => {
    expect(
      parseLibraryQuery({
        q: "  systems  ",
        format: "pdf",
        status: "ready",
        sort: "title",
        view: "list",
        page: "3",
      }),
    ).toMatchObject({ q: "systems", format: "PDF", status: "READY", sort: "title", view: "list", page: 3 });
  });

  it("falls back safely for unsupported values", () => {
    expect(parseLibraryQuery({ format: "exe", status: "deleted", sort: "random", page: "-4" })).toMatchObject({
      format: undefined,
      status: undefined,
      sort: "recent",
      view: "grid",
      page: 1,
    });
  });
});
