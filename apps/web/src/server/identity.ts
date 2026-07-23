// Identity sealing (spec principle 2 / section 7).
//
// A pupil is shown as a sealed reference — never a name — until a case reaches
// the action threshold and a DSL reveals it with a reason (that reveal, gated
// and audited, arrives with the case-view slice). Every pupil-facing surface
// built from here on defaults to sealed: the safe default is to expose no
// identifying data. This helper derives a stable, non-identifying reference
// from the pupil's UPN so the same child reads consistently across screens
// without ever surfacing a name.
export function sealPupilRef(upn: string): string {
  const digits = upn.replace(/\D/g, "");
  const tail = digits.slice(-4) || digits || "0000";
  return `Pupil ${tail}`;
}

// The only reasons a DSL may give for revealing a pupil's identity. A reveal is
// never casual: it is warranted by a concrete safeguarding action, and the
// chosen reason is written to the audit trail with the reveal (spec principle
// 2 / section 7). A closed list keeps the reason auditable and consistent.
export const REVEAL_REASONS = [
  "Required for a referral",
  "Required for parental contact",
  "Safeguarding decision recorded",
] as const;

export type RevealReason = (typeof REVEAL_REASONS)[number];
