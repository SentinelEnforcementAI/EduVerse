import { attendanceDrop } from "./rules/attendance-drop";
import { attainmentDecline } from "./rules/attainment-decline";
import { behaviourSpike } from "./rules/behaviour-spike";
import { crossDomain } from "./rules/cross-domain";
import { sustainedAbsence } from "./rules/sustained-absence";
import type { RuleDefinition } from "./types";

// The five starter rules. Changing a rule's params or logic requires bumping
// its version — the engine enforces this against the stored definitions.
export const RULES: RuleDefinition[] = [
  attendanceDrop,
  behaviourSpike,
  attainmentDecline,
  crossDomain,
  sustainedAbsence,
];
