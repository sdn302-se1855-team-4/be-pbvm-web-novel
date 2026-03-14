# Base stage for installing dependencies and building the app
FROM node:20-alpine AS builder

RUN npm install -g pnpm
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm dlx prisma generate
RUN pnpm run build

# Production stage
FROM node:20-alpine AS runner

RUN npm install -g pnpm
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/prisma ./prisma

# Generate Prisma Client cho đúng binary của runner
RUN pnpm dlx prisma generate

EXPOSE 3000
CMD ["pnpm", "run", "start:prod"]
