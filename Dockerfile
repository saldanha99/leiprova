# syntax=docker/dockerfile:1.7
FROM node:22.22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches ./patches
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

FROM deps AS builder
WORKDIR /app
ARG LEIPROVA_BUILD_PROFILE=production
COPY . .
RUN case "$LEIPROVA_BUILD_PROFILE" in \
      production) pnpm build ;; \
      qa) LEIPROVA_QA_ENVIRONMENT=synthetic \
          APP_URL=https://homolog.leiprova.2b.app.br \
          NEXT_PUBLIC_APP_URL=https://homolog.leiprova.2b.app.br pnpm build ;; \
      *) echo "Perfil de build inválido" >&2; exit 1 ;; \
    esac

FROM deps AS migrator
WORKDIR /app
COPY . .
CMD ["pnpm", "db:migrate"]

FROM node:22.22-alpine AS runner
WORKDIR /app
ARG LEIPROVA_BUILD_PROFILE=production
LABEL io.leiprova.build-profile=$LEIPROVA_BUILD_PROFILE
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
