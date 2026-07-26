import { randomUUID } from "node:crypto";

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { systemDb, type User } from "@sentinel/db";

import { setEmailSenderForTesting } from "@/server/auth/email";
import { hashToken } from "@/server/auth/tokens";
import {
  consumeMagicLink,
  MAGIC_LINK_MAX_PER_WINDOW,
  requestMagicLink,
} from "@/server/auth/magic-link";

// Magic-link hardening against the real database: the public request endpoint
// is rate-limited per account, and consumption is single-use even under a
// concurrent race.

const run = randomUUID().slice(0, 8);
const email = `ml-${run}@downlands.example`;

let tenantId: string;
let user: User;
const sent: string[] = [];

beforeAll(async () => {
  // Capture "sent" links instead of hitting a transport.
  setEmailSenderForTesting(async ({ to }) => {
    sent.push(to);
  });
  const tenant = await systemDb.tenant.create({
    data: { name: `ML ${run}`, slug: `ml-${run}` },
  });
  tenantId = tenant.id;
  user = await systemDb.user.create({
    data: { email, role: "DSL", tenantId },
  });
});

afterEach(async () => {
  await systemDb.magicLinkToken.deleteMany({ where: { userId: user.id } });
  sent.length = 0;
});

afterAll(async () => {
  setEmailSenderForTesting(null);
  await systemDb.magicLinkToken.deleteMany({ where: { userId: user.id } });
  await systemDb.user.deleteMany({ where: { id: user.id } });
  await systemDb.tenant.deleteMany({ where: { id: tenantId } });
});

describe("requestMagicLink rate limiting", () => {
  it("caps the number of links sent to one account in a window", async () => {
    for (let i = 0; i < MAGIC_LINK_MAX_PER_WINDOW + 3; i++) {
      await requestMagicLink(systemDb, email);
    }
    const tokens = await systemDb.magicLinkToken.count({
      where: { userId: user.id },
    });
    expect(tokens).toBe(MAGIC_LINK_MAX_PER_WINDOW);
    expect(sent).toHaveLength(MAGIC_LINK_MAX_PER_WINDOW);
  });

  it("does not create a token for an unknown address", async () => {
    await requestMagicLink(systemDb, `nobody-${run}@nowhere.example`);
    expect(sent).toHaveLength(0);
  });

  it("does not send to a deactivated account", async () => {
    await systemDb.user.update({
      where: { id: user.id },
      data: { status: "DEACTIVATED" },
    });
    await requestMagicLink(systemDb, email);
    expect(sent).toHaveLength(0);
    await systemDb.user.update({
      where: { id: user.id },
      data: { status: "ACTIVE" },
    });
  });
});

describe("consumeMagicLink single-use", () => {
  async function mintToken(): Promise<string> {
    const raw = `raw-${randomUUID()}`;
    await systemDb.magicLinkToken.create({
      data: {
        tokenHash: hashToken(raw),
        userId: user.id,
        tenantId,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });
    return raw;
  }

  it("accepts a token once and rejects the second use", async () => {
    const raw = await mintToken();
    const first = await consumeMagicLink(systemDb, raw);
    const second = await consumeMagicLink(systemDb, raw);
    expect(first.ok).toBe(true);
    expect(second).toEqual({ ok: false, reason: "expired_or_used" });
  });

  it("only one of two concurrent consumers wins the race", async () => {
    const raw = await mintToken();
    const [a, b] = await Promise.all([
      consumeMagicLink(systemDb, raw),
      consumeMagicLink(systemDb, raw),
    ]);
    const wins = [a, b].filter((r) => r.ok).length;
    expect(wins).toBe(1);
  });
});
