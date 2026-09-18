import { describe, expect, it } from "vitest";

import { getAuthCapabilities, parseServerEnvironment } from "@/lib/env";

const baseEnvironment = {
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/sonicpages",
  AUTH_SECRET: "a-secure-test-secret-that-is-long-enough",
};

describe("server environment", () => {
  it("accepts the required database and authentication settings", () => {
    expect(parseServerEnvironment(baseEnvironment)).toMatchObject(baseEnvironment);
  });

  it("rejects partially configured Google authentication", () => {
    expect(() =>
      parseServerEnvironment({ ...baseEnvironment, AUTH_GOOGLE_ID: "client-id" }),
    ).toThrow(/configured together/);
  });

  it("rejects partially configured email authentication", () => {
    expect(() =>
      parseServerEnvironment({ ...baseEnvironment, EMAIL_FROM: "hello@example.com" }),
    ).toThrow(/configured together/);
  });

  it("reports only fully configured sign-in capabilities", () => {
    expect(getAuthCapabilities(baseEnvironment)).toEqual({ google: false, email: false });
    expect(
      getAuthCapabilities({
        ...baseEnvironment,
        AUTH_GOOGLE_ID: "client-id",
        AUTH_GOOGLE_SECRET: "client-secret",
      }),
    ).toEqual({ google: true, email: false });
  });
});
