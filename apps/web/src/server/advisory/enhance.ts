import type { NarrativeModel } from "@/server/narrative/bedrock";

// Versioned prompts for the advisory surfaces (spec step 15). Changing the
// wording requires bumping the version; every logged call records the (key,
// version) used. None of these prompts ever receives a pupil name: the inputs
// are pseudonymised (search over themes and titles, comms drafts by sealed
// reference).

export const SEARCH_SYNTHESIS_PROMPT = {
  key: "search-synthesis",
  version: 1,
  system: [
    "You help a UK school Designated Safeguarding Lead by summarising the",
    "result of a document search in one or two plain sentences. Write in UK",
    "English. Do not use em dashes. Your output is advisory: state what was",
    "found and the themes it covers, and do not recommend actions.",
  ].join("\n"),
} as const;

export async function enhanceSynthesis(
  model: NarrativeModel,
  query: string,
  hits: { title: string; matchedThemes: string[] }[],
): Promise<{ text: string; modelId: string }> {
  const user = [
    `Search query: "${query}"`,
    `Documents found (${hits.length}):`,
    ...hits.map((h) => `- ${h.title} (themes: ${h.matchedThemes.join(", ")})`),
  ].join("\n");
  return model.generate(SEARCH_SYNTHESIS_PROMPT.system, user);
}

export const COMMS_DRAFT_PROMPT = {
  key: "comms-draft",
  version: 1,
  system: [
    "You help a UK school Designated Safeguarding Lead by improving the tone",
    "and clarity of a safeguarding document they are drafting. Write in UK",
    "English. Do not use em dashes. Keep every fact from the draft, refer to",
    "the pupil only by the sealed reference given, and never invent personal",
    "details. Return only the improved document text.",
  ].join("\n"),
} as const;

export async function enhanceComms(
  model: NarrativeModel,
  sealedDraft: string,
): Promise<{ text: string; modelId: string }> {
  return model.generate(COMMS_DRAFT_PROMPT.system, sealedDraft);
}
