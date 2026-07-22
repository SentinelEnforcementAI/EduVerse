# Web app image (Next.js standalone). Build from the repo root:
#   docker build -f apps/web/Dockerfile -t sentinel-watch-web .
FROM node:22-slim AS base
RUN corepack enable pnpm
WORKDIR /repo

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/
COPY packages/db/package.json packages/db/
COPY packages/rules/package.json packages/rules/
COPY packages/sync/package.json packages/sync/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @sentinel/db db:generate
# next build validates nothing at runtime (env.ts skips validation during
# the build phase); real configuration arrives from the task definition.
RUN NEXT_PHASE=phase-production-build pnpm --filter web build

FROM node:22-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN groupadd --system app && useradd --system --gid app app
COPY --from=build --chown=app:app /repo/apps/web/.next/standalone ./
COPY --from=build --chown=app:app /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=app:app /repo/apps/web/public ./apps/web/public
USER app
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["node", "apps/web/server.js"]
