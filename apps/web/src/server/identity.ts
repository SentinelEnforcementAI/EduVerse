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
