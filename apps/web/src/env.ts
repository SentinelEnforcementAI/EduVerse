import { z } from "zod";

// Server-side environment validation. Import this only from server code.
// Every variable here must be documented in .env.example.
const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    // Reserved for the Redis-backed sync queue (build step 4). Documented now
    // so Docker Compose and .env.example stay in lockstep with the stack.
    REDIS_URL: z.string().min(1).optional(),
    APP_URL: z.string().url().default("http://localhost:3000"),
    // "console" logs magic links to the server terminal (local dev only).
    // "ses" sends via AWS SES in eu-west-2 — email dispatch stays inside UK
    // infrastructure (data residency principle). The region is hardcoded in
    // code, not configurable.
    EMAIL_TRANSPORT: z.enum(["console", "ses"]).default("console"),
    // Verified SES sender, e.g. "Sentinel Watch <signin@sentinelwatch.co.uk>".
    EMAIL_FROM: z.string().min(3).optional(),
  })
  .refine(
    (value) => value.EMAIL_TRANSPORT !== "ses" || Boolean(value.EMAIL_FROM),
    { message: "EMAIL_FROM is required when EMAIL_TRANSPORT=ses" },
  );

type Env = z.infer<typeof envSchema>;

// `next build` evaluates server modules to collect route data without any
// runtime environment; real validation happens on every actual boot.
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

export const env: Env = isBuildPhase
  ? (process.env as unknown as Env)
  : envSchema.parse(process.env);
