import { bedrockNarrativeModel, type NarrativeModel } from "./bedrock";

// Indirection so tests can substitute a fake model. Production always uses
// Bedrock in eu-west-2; the factory is only replaceable from test code.
let factory: (() => NarrativeModel) | null = null;

export function getNarrativeModel(): NarrativeModel {
  return (factory ?? bedrockNarrativeModel)();
}

export function setNarrativeModelFactoryForTesting(
  override: (() => NarrativeModel) | null,
): void {
  factory = override;
}
