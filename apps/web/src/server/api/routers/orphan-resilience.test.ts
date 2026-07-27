import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { dbForTenant, resolveTenancy, systemDb } from "@sentinel/db";

import { createCaller } from "@/server/api/root";
import type { TRPCContext } from "@/server/api/trpc";

// Every signal->pupil read must survive a signal whose pupil is unreadable
// under its school's RLS context (the production fault, digest 1704990025).
// We inject exactly that (a Downlands signal pointing at a Patcham pupil) and
// assert the list surfaces render instead of 500ing.

async function ctxFor(email: string): Promise<TRPCContext> {
  const user = await systemDb.user.findFirstOrThrow({ where: { email } });
  const tenancy = await resolveTenancy(user);
  return {
    db: systemDb,
    session: { user } as never,
    tenantId: user.tenantId,
    tenantDb: user.tenantId ? dbForTenant(user.tenantId) : null,
    tenancy,
    headers: new Headers(),
  } as TRPCContext;
}

let victimSignalId: string;
let originalPupilId: string;
let downlandsId: string;

beforeAll(async () => {
  const downlands = await systemDb.tenant.findUniqueOrThrow({
    where: { slug: "downlands" },
  });
  const patcham = await systemDb.tenant.findUniqueOrThrow({
    where: { slug: "patcham" },
  });
  downlandsId = downlands.id;
  const foreign = await systemDb.pupil.findFirstOrThrow({
    where: { tenantId: patcham.id },
    select: { id: true },
  });
  const victim = await systemDb.signal.findFirstOrThrow({
    where: { tenantId: downlands.id, status: "OPEN" },
    select: { id: true, pupilId: true },
  });
  victimSignalId = victim.id;
  originalPupilId = victim.pupilId;
  await systemDb.signal.update({
    where: { id: victim.id },
    data: { pupilId: foreign.id },
  });
});

afterAll(async () => {
  await systemDb.signal.update({
    where: { id: victimSignalId },
    data: { pupilId: originalPupilId },
  });
});

describe("signal->pupil reads survive an unreadable pupil", () => {
  it("director list surfaces do not throw", async () => {
    const caller = createCaller(await ctxFor("director@weald-learning-trust.example"));
    await expect(caller.casework.triage({ key: "active" })).resolves.toBeTruthy();
    await expect(caller.casework.onCall()).resolves.toBeTruthy();
    await expect(caller.cohort.patterns()).resolves.toBeTruthy();
    await expect(caller.search.query({ q: "year" })).resolves.toBeTruthy();
    await expect(caller.overview.alerts()).resolves.toBeTruthy();
  });

  it("DSL list surfaces do not throw", async () => {
    const caller = createCaller(await ctxFor("dsl@downlands.example"));
    await expect(caller.signals.list({ status: "OPEN" })).resolves.toBeTruthy();
    await expect(
      caller.intake.list({ schoolId: downlandsId }),
    ).resolves.toBeTruthy();
    await expect(
      caller.overview.school({ schoolId: downlandsId }),
    ).resolves.toBeTruthy();
  });

  it("opening the orphaned case degrades to NOT_FOUND, not a 500", async () => {
    const caller = createCaller(await ctxFor("dsl@downlands.example"));
    await expect(
      caller.casework.case({ signalId: victimSignalId, schoolId: downlandsId }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
