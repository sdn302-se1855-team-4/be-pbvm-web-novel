# Base stage for installing dependencies and building the app
FROM node:20-alpine AS builder

# Install pnpm
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy project files and Prisma schema
COPY . .

# Generate Prisma Client
RUN pnpm dlx prisma generate

# Build the application
RUN pnpm run build

# Production stage
FROM node:20-alpine AS runner

# Install pnpm
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Set environment variable
ENV NODE_ENV=production

# Copy only necessary files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/prisma ./prisma

# Expose port 3000
EXPOSE 3000

# Start the application
CMD ["pnpm", "run", "start:prod"]
