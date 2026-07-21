import { describe, expect, it, vi } from "vitest";

import type { User } from "@sentinel/db";

import { createCaller } from "@/server/api/root";
import type { TRPCContext } from "@/server/api/trpc";

const tenantUser: User = {
  id: "user_1",
  email: "dsl@downlands.example.org.uk",
  name: "Test DSL",
  tenantId: "tenant_a",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

function contextWith(overrides: Partial<TRPCContext>): TRPCContext {
  return {
    db: {} as TRPCContext["db"],
    session: null,
    tenantId: null,
    tenantDb: null,
    headers: new Headers(),
    ...overrides,
  };
}

describe("tenant.current", () => {
  it("rejects unauthenticated callers", async () => {
    const caller = createCaller(contextWith({}));
    await expect(caller.tenant.current()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("rejects signed-in users with no school attached", async () => {
    const caller = createCaller(
      contextWith({
        session: {
          sessionId: "sess_1",
          user: { ...tenantUser, tenantId: null },
        },
      }),
    );
    await expect(caller.tenant.current()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("returns the caller's school via the tenant-scoped client", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: "tenant_a",
      name: "Downlands",
      slug: "downlands",
    });
    const caller = createCaller(
      contextWith({
        session: { sessionId: "sess_1", user: tenantUser },
        tenantId: "tenant_a",
        tenantDb: {
          tenant: { findUnique },
        } as unknown as TRPCContext["tenantDb"],
      }),
    );

    await expect(caller.tenant.current()).resolves.toEqual({
      id: "tenant_a",
      name: "Downlands",
      slug: "downlands",
    });
    expect(findUnique).toHaveBeenCalledWith({ where: { id: "tenant_a" } });
  });
});
