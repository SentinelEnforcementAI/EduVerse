import { z } from "zod";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "@/server/api/trpc";
import { requestMagicLink } from "@/server/auth/magic-link";

export const authRouter = createTRPCRouter({
  // Starts the magic link flow. Always returns ok so responses don't reveal
  // which addresses hold accounts.
  requestMagicLink: publicProcedure
    .input(
      z.object({
        email: z
          .string()
          .trim()
          .pipe(z.email("Enter a valid email address")),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requestMagicLink(ctx.db, input.email);
      return { ok: true as const };
    }),

  // The signed-in user, for the dashboard shell.
  me: protectedProcedure.query(({ ctx }) => ({
    id: ctx.session.user.id,
    email: ctx.session.user.email,
    name: ctx.session.user.name,
  })),
});
