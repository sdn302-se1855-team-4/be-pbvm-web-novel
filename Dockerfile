# 1. Base image for pnpm
FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

# 2. Stage for building the application
FROM base AS builder
COPY package.json pnpm-lock.yaml .npmrc* ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm dlx prisma generate
RUN pnpm run build

# 3. Stage for production dependencies only
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml .npmrc* ./
COPY prisma ./prisma
RUN pnpm install --prod --frozen-lockfile
RUN pnpm dlx prisma generate

# 4. Production runner stage
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 --ingroup nodejs appuser

COPY --from=builder /app/dist ./dist
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/package.json ./package.json

USER appuser

EXPOSE 3000

CMD ["node", "dist/src/main"]