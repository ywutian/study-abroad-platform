# ============================================
# Stage 1: Build
# ============================================
FROM node:20-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.22.0 --activate

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/ ./packages/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY apps/api/ ./apps/api/

# Generate Prisma client (dummy URL for generation only)
RUN cd apps/api && DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" pnpm prisma generate

# Build
RUN pnpm --filter api build

# ============================================
# Stage 2: Production
# ============================================
FROM node:20-alpine AS runner

RUN apk add --no-cache curl

WORKDIR /app

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/node_modules ./node_modules
COPY --from=builder /app/apps/api/prisma ./prisma
COPY --from=builder /app/apps/api/package.json ./

RUN chown -R nestjs:nodejs /app
USER nestjs

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]

