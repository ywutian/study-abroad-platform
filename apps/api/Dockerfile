# ============================================
# Stage 1: Build
# ============================================
FROM node:20-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/ ./packages/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY apps/api/ ./apps/api/
COPY tsconfig.json ./

# Generate Prisma client
RUN cd apps/api && pnpm prisma generate

# Build
RUN pnpm --filter api build

# ============================================
# Stage 2: Production
# ============================================
FROM node:20-alpine AS runner

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

# Copy built assets
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/node_modules ./node_modules
COPY --from=builder /app/apps/api/prisma ./prisma
COPY --from=builder /app/apps/api/package.json ./

# Set ownership
RUN chown -R nestjs:nodejs /app

USER nestjs

# Expose port
EXPOSE 3001

# Run migrations and start
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
