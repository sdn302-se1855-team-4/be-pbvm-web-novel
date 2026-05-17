# 1. Base image for pnpm
FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

# 2. Stage for building the application
FROM base AS builder
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --allow-build=bcrypt,@prisma/engines,prisma,protobufjs,msgpackr-extract,@firebase/util,@nestjs/core,@scarf/scarf
COPY . .
RUN pnpm dlx prisma generate
RUN pnpm run build

# 3. Stage for production dependencies only
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
RUN pnpm install --prod --frozen-lockfile --allow-build=bcrypt,@prisma/engines,prisma,protobufjs,msgpackr-extract,@firebase/util,@nestjs/core,@scarf/scarf
RUN pnpm dlx prisma generate

# 4. Production runner stage
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/dist ./dist
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/package.json ./package.json

EXPOSE 3000

CMD ["node", "dist/src/main"]