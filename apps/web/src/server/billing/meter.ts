import { systemDb } from "@sentinel/db";

export { formatMoney } from "@/lib/money";

// Metering + pricing for a trust (commercialisation slice 5). The commercial
// model is cost-per-pupil plus a flat fee per MAT. All money is integer pence.
// Billing is trust-level and reached only through the system context; callers
// pass the administrator's OWN trustId, taken from their session — there is no
// path here to another trust's numbers.

// Default (provisional) pricing, used when a trust has no billing account yet.
// CTO-DECISION: the per-pupil rate is the commercial figure to confirm; the MAT
// fee is the agreed £50,000/year.
const DEFAULT_PER_PUPIL_PENCE = 500;
const DEFAULT_MAT_FEE_PENCE = 5_000_000;
const DEFAULT_CURRENCY = "GBP";

export type SchoolUsage = {
  id: string;
  name: string;
  pupilCount: number;
};

export type BillingBasis = {
  currency: string;
  perPupilPence: number;
  matFeePence: number;
  pupilCount: number;
  schools: SchoolUsage[];
  usagePence: number;
  totalPence: number;
  // False when the trust has no billing account row (defaults are shown).
  hasAccount: boolean;
};

// Computes the current billing basis for a trust: the pupil count per school,
// the pricing that applies, and the lines (per-pupil usage + the MAT fee).
export async function computeBilling(trustId: string): Promise<BillingBasis> {
  const account = await systemDb.billingAccount.findUnique({
    where: { trustId },
  });
  const perPupilPence = account?.perPupilPencePerYear ?? DEFAULT_PER_PUPIL_PENCE;
  const matFeePence = account?.matFeePence ?? DEFAULT_MAT_FEE_PENCE;
  const currency = account?.currency ?? DEFAULT_CURRENCY;

  const tenants = await systemDb.tenant.findMany({
    where: { trustId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const schoolIds = tenants.map((t) => t.id);

  const counts = schoolIds.length
    ? await systemDb.pupil.groupBy({
        by: ["tenantId"],
        where: { tenantId: { in: schoolIds } },
        _count: { _all: true },
      })
    : [];
  const countByTenant = new Map(counts.map((c) => [c.tenantId, c._count._all]));

  const schools: SchoolUsage[] = tenants.map((t) => ({
    id: t.id,
    name: t.name,
    pupilCount: countByTenant.get(t.id) ?? 0,
  }));
  const pupilCount = schools.reduce((n, s) => n + s.pupilCount, 0);
  const usagePence = pupilCount * perPupilPence;
  const totalPence = usagePence + matFeePence;

  return {
    currency,
    perPupilPence,
    matFeePence,
    pupilCount,
    schools,
    usagePence,
    totalPence,
    hasAccount: account !== null,
  };
}
