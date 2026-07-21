import { AnthropicBedrockMantle } from "@anthropic-ai/bedrock-sdk";

// UK data residency is structural: the region is a constant, not
// configuration. All inference runs on AWS Bedrock in London.
export const BEDROCK_REGION = "eu-west-2" as const;

const DEFAULT_MODEL_ID = "anthropic.claude-opus-4-8";

export type NarrativeModel = {
  generate(system: string, user: string): Promise<{ text: string; modelId: string }>;
};

// Server-side only — this module must never be imported from client code.
// AWS credentials come from the standard SDK chain (env vars locally,
// instance role in production).
export function bedrockNarrativeModel(): NarrativeModel {
  const client = new AnthropicBedrockMantle({ awsRegion: BEDROCK_REGION });
  const modelId = process.env.BEDROCK_MODEL_ID ?? DEFAULT_MODEL_ID;

  return {
    async generate(system, user) {
      const response = await client.messages.create({
        model: modelId,
        max_tokens: 1024,
        system,
        messages: [{ role: "user", content: user }],
      });
      const text = response.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("\n")
        .trim();
      if (!text) {
        throw new Error("The model returned no narrative text.");
      }
      return { text, modelId };
    },
  };
}
