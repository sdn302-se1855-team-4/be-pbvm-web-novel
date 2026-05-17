# 1. Base image for pnpm
FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

# 2. Stage for building the application
FROM base AS builder
COPY package.json pnpm-lock.yaml ./
# Install all dependencies including devDependencies
RUN pnpm install --frozen-lockfile
COPY . .
# Generate Prisma client and build
RUN pnpm dlx prisma generate
RUN pnpm run build

# 3. Stage for production dependencies only
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
# Install only production dependencies
RUN pnpm install --prod --frozen-lockfile
# Generate Prisma client for production node_modules
RUN pnpm dlx prisma generate

# 4. Production runner stage
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy only what's needed to run the app
COPY --from=builder /app/dist ./dist
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/package.json ./package.json

EXPOSE 3000

# Run the app directly with node for better performance and smaller image
CMD ["node", "dist/src/main"]
