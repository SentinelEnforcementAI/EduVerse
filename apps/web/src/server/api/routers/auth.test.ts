import { describe, expect, it, vi } from "vitest";

import type { User } from "@sentinel/db";

import { createCaller } from "@/server/api/root";
import type { TRPCContext } from "@/server/api/trpc";

const testUser: User = {
  id: "user_1",
  email: "dsl@downlands.example.org.uk",
  name: "Test DSL",
  role: "DSL",
  status: "ACTIVE",
  deactivatedAt: null,
  trustId: null,
  tenantId: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

function contextWith(overrides: Partial<TRPCContext>): TRPCContext {
  return {
    db: {} as TRPCContext["db"],
    session: null,
    tenantId: null,
    tenantDb: null,
    tenancy: null,
    headers: new Headers(),
    ...overrides,
  };
}

describe("auth.me", () => {
  it("rejects unauthenticated callers", async () => {
    const caller = createCaller(contextWith({ session: null }));
    await expect(caller.auth.me()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("returns the signed-in user", async () => {
    const caller = createCaller(
      contextWith({ session: { sessionId: "sess_1", user: testUser } }),
    );
    await expect(caller.auth.me()).resolves.toEqual({
      id: testUser.id,
      email: testUser.email,
      name: testUser.name,
    });
  });
});

describe("auth.requestMagicLink", () => {
  it("rejects an invalid email before touching the database", async () => {
    const caller = createCaller(contextWith({}));
    await expect(
      caller.auth.requestMagicLink({ email: "not-an-email" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("stores only a hash of the token and emails the raw link", async () => {
    const findUnique = vi.fn().mockResolvedValue(testUser);
    const create = vi.fn().mockResolvedValue({});
    const db = {
      user: { findUnique },
      magicLinkToken: { create },
    } as unknown as TRPCContext["db"];
    const consoleSpy = vi
      .spyOn(console, "info")
      .mockImplementation(() => undefined);

    const caller = createCaller(contextWith({ db }));
    const result = await caller.auth.requestMagicLink({
      email: "  DSL@Downlands.example.org.uk ",
    });

    expect(result).toEqual({ ok: true });
    // Email is normalised before lookup.
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: "dsl@downlands.example.org.uk" },
      }),
    );

    const tokenHash = create.mock.calls[0]?.[0]?.data?.tokenHash as string;
    expect(tokenHash).toMatch(/^[a-f0-9]{64}$/);

    // The emailed link carries the raw token, never the stored hash.
    const emailOutput = consoleSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    const url = emailOutput.match(/https?:\/\/\S+/)?.[0];
    expect(url).toContain("/api/auth/verify?token=");
    expect(url).not.toContain(tokenHash);

    consoleSpy.mockRestore();
  });

  // Sign-in is invite-only: an unknown address must not create an account,
  // must not receive an email, and must get a response indistinguishable
  // from a known address — so the endpoint can't enumerate accounts.
  it("silently ignores unknown addresses without creating a user", async () => {
    const findUnique = vi.fn().mockResolvedValue(null);
    const tokenCreate = vi.fn();
    const userCreate = vi.fn();
    const userUpsert = vi.fn();
    const db = {
      user: { findUnique, create: userCreate, upsert: userUpsert },
      magicLinkToken: { create: tokenCreate },
    } as unknown as TRPCContext["db"];
    const consoleSpy = vi
      .spyOn(console, "info")
      .mockImplementation(() => undefined);

    const caller = createCaller(contextWith({ db }));
    const result = await caller.auth.requestMagicLink({
      email: "stranger@nowhere.example",
    });

    // Same response as the known-address path.
    expect(result).toEqual({ ok: true });
    expect(userCreate).not.toHaveBeenCalled();
    expect(userUpsert).not.toHaveBeenCalled();
    expect(tokenCreate).not.toHaveBeenCalled();
    expect(consoleSpy).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});
