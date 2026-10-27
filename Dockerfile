# syntax=docker/dockerfile:1
FROM node:22.23.4-alpine AS base

FROM base AS builder
WORKDIR /app

# pnpm 버전 고정
RUN npm install -g pnpm@9.1.0

# pnpm 워크스페이스 설정 및 각 패키지의 manifest만 먼저 복사 (의존성 레이어 캐시 최적화)
# 새 workspace 패키지(packages/*)를 추가하면 해당 package.json 복사 라인도 추가해야 합니다.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/package.json
COPY packages/config/package.json ./packages/config/package.json
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/tokens/package.json ./packages/tokens/package.json
# 빌드 간 pnpm 스토어 캐시 재사용으로 의존성 설치 시간 단축 (--store-dir로 경로 명시, sharing=locked으로 동시 빌드 충돌 방지)
RUN --mount=type=cache,id=globber-pnpm-store,sharing=locked,target=/pnpm-store \
    pnpm install --frozen-lockfile --store-dir /pnpm-store

COPY . .

# 빌드 시 환경변수 설정
ARG NEXT_PUBLIC_BASE_URL
ARG NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
ARG NEXT_PUBLIC_REDIRECT_ORIGIN
ARG NEXT_PUBLIC_S3_BASE_URL
ARG GOOGLE_MAPS_API_KEY
ARG NEXT_PUBLIC_GA_MEASUREMENT_ID
ARG NEXT_PUBLIC_MAINTENANCE_MODE
ENV NEXT_PUBLIC_BASE_URL=${NEXT_PUBLIC_BASE_URL}
ENV NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=${NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
ENV NEXT_PUBLIC_REDIRECT_ORIGIN=${NEXT_PUBLIC_REDIRECT_ORIGIN}
ENV GOOGLE_MAPS_API_KEY=${GOOGLE_MAPS_API_KEY}
ENV NEXT_PUBLIC_GA_MEASUREMENT_ID=${NEXT_PUBLIC_GA_MEASUREMENT_ID}
ENV NEXT_PUBLIC_MAINTENANCE_MODE=${NEXT_PUBLIC_MAINTENANCE_MODE}
ENV NODE_ENV=production
# 빌드 중 Node.js 최대 힙 메모리 명시 (self-hosted runner OOM kill 방지)
ENV NODE_OPTIONS="--max-old-space-size=3072"

# 빌드 간 webpack 캐시 재사용으로 빌드 시간 단축 (sharing=locked으로 동시 빌드 캐시 충돌 방지)
RUN --mount=type=cache,id=globber-nextjs-cache,sharing=locked,target=/app/apps/web/.next/cache \
    pnpm run build:web

FROM base AS runner
WORKDIR /app

# 계정 설정
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
USER nextjs

# Next.js standalone 빌드 아티팩트만 복사 (중요!)
# 모노레포(outputFileTracingRoot)이므로 standalone 내부에 apps/web 경로가 유지됩니다.
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/next.config.ts ./apps/web/next.config.ts
COPY --from=builder /app/apps/web/package.json ./apps/web/package.json

ENV PORT=80
CMD ["node", "apps/web/server.js"]