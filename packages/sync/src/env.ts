import { z } from "zod";

// Read lazily so importing the package never requires Wonde credentials —
// only actually running a sync against the real API does.
const envSchema = z.object({
  REDIS_URL: z.string().min(1).default("redis://localhost:6379"),
  WONDE_API_KEY: z.string().min(1).optional(),
  WONDE_SCHOOL_ID: z.string().min(1).optional(),
  WONDE_BASE_URL: z.string().url().default("https://api.wonde.com"),
});

export function syncEnv() {
  return envSchema.parse(process.env);
}

export function requireWondeApiKey(): string {
  const { WONDE_API_KEY } = syncEnv();
  if (!WONDE_API_KEY) {
    throw new Error(
      "WONDE_API_KEY is not set. Register at wonde.com/developers for sandbox " +
        "access and put the key in .env (never in the repo).",
    );
  }
  return WONDE_API_KEY;
}
