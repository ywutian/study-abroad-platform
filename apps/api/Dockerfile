# ============================================
# Stage 1: Build
# ============================================
FROM node:20-alpine AS builder

# Install pnpm and openssl
RUN corepack enable && corepack prepare pnpm@10.22.0 --activate
RUN apk add --no-cache openssl

WORKDIR /app

# Copy package files for all workspace packages (needed for frozen-lockfile)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY apps/mobile/package.json ./apps/mobile/
COPY packages/ ./packages/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY apps/api/ ./apps/api/

# Generate Prisma client (dummy URL for generation only)
RUN cd apps/api && DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" pnpm prisma generate

# Build
RUN pnpm --filter api build

# Deploy to /prod with all dependencies (pnpm deploy creates standalone package)
RUN pnpm --filter api deploy /prod --prod --legacy

# Copy Prisma client to deployed node_modules
RUN cp -r /app/node_modules/.pnpm/@prisma+client@*/node_modules/@prisma/client /prod/node_modules/@prisma/client && \
    cp -r /app/node_modules/.pnpm/@prisma+client@*/node_modules/.prisma /prod/node_modules/.prisma

# ============================================
# Stage 2: Production Runner
# ============================================
FROM node:20-alpine AS runner

# Install openssl for Prisma
RUN apk add --no-cache openssl

WORKDIR /app

# Copy deployed application with all dependencies
COPY --from=builder /prod ./

# Copy built application
COPY --from=builder /app/apps/api/dist ./dist

# Copy Prisma schema and migrations for migrate deploy
COPY --from=builder /app/apps/api/prisma ./prisma

# Copy entrypoint script
COPY --from=builder /app/apps/api/entrypoint.sh ./entrypoint.sh
RUN chmod +x entrypoint.sh

# Railway will set PORT env var
EXPOSE 8080

# Run migrations on startup, then start application
CMD ["./entrypoint.sh"]
