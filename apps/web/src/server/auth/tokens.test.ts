import { describe, expect, it } from "vitest";

import {
  generateToken,
  hashToken,
  isMagicLinkUsable,
  isSessionActive,
  MAGIC_LINK_TTL_MINUTES,
  magicLinkExpiry,
} from "@/server/auth/tokens";

describe("generateToken", () => {
  it("produces unique, URL-safe tokens", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toEqual(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(a.length).toBeGreaterThanOrEqual(43); // 32 bytes base64url
  });
});

describe("hashToken", () => {
  it("is deterministic and never equals the raw token", () => {
    const token = generateToken();
    expect(hashToken(token)).toEqual(hashToken(token));
    expect(hashToken(token)).not.toEqual(token);
    expect(hashToken(token)).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("magicLinkExpiry", () => {
  it("expires the configured number of minutes ahead", () => {
    const now = new Date("2026-01-01T09:00:00Z");
    expect(magicLinkExpiry(now).getTime() - now.getTime()).toEqual(
      MAGIC_LINK_TTL_MINUTES * 60 * 1000,
    );
  });
});

describe("isMagicLinkUsable", () => {
  const now = new Date("2026-01-01T09:00:00Z");
  const future = new Date("2026-01-01T09:10:00Z");
  const past = new Date("2026-01-01T08:50:00Z");

  it("accepts an unconsumed, unexpired token", () => {
    expect(
      isMagicLinkUsable({ expiresAt: future, consumedAt: null }, now),
    ).toBe(true);
  });

  it("rejects an expired token", () => {
    expect(isMagicLinkUsable({ expiresAt: past, consumedAt: null }, now)).toBe(
      false,
    );
  });

  it("rejects a consumed token (single use)", () => {
    expect(
      isMagicLinkUsable({ expiresAt: future, consumedAt: past }, now),
    ).toBe(false);
  });
});

describe("isSessionActive", () => {
  const now = new Date("2026-01-01T09:00:00Z");
  const future = new Date("2026-01-08T09:00:00Z");
  const past = new Date("2025-12-25T09:00:00Z");

  it("accepts an unrevoked, unexpired session", () => {
    expect(isSessionActive({ expiresAt: future, revokedAt: null }, now)).toBe(
      true,
    );
  });

  it("rejects an expired session", () => {
    expect(isSessionActive({ expiresAt: past, revokedAt: null }, now)).toBe(
      false,
    );
  });

  it("rejects a revoked session", () => {
    expect(isSessionActive({ expiresAt: future, revokedAt: past }, now)).toBe(
      false,
    );
  });
});
