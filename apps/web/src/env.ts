import { z } from "zod";

// Server-side environment validation. Import this only from server code.
// Every variable here must be documented in .env.example.
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  // Reserved for the Redis-backed sync queue (build step 4). Documented now so
  // Docker Compose and .env.example stay in lockstep with the stack.
  REDIS_URL: z.string().min(1).optional(),
  APP_URL: z.string().url().default("http://localhost:3000"),
  // "console" logs magic links to the server terminal (local dev only).
  // CTO-DECISION: production email provider. AWS SES in eu-west-2 keeps email
  // inside UK infrastructure; wire it here as a second transport when decided.
  EMAIL_TRANSPORT: z.enum(["console"]).default("console"),
});

type Env = z.infer<typeof envSchema>;

// `next build` evaluates server modules to collect route data without any
// runtime environment; real validation happens on every actual boot.
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

export const env: Env = isBuildPhase
  ? (process.env as unknown as Env)
  : envSchema.parse(process.env);
