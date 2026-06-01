# ============================================
# Stage 1: Build
# ============================================
FROM node:26-alpine AS builder

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

# Build shared package first (API depends on it)
RUN pnpm --filter @study-abroad/shared build

# Build API
RUN pnpm --filter api build

# Compile every seed-orchestrator data step into plain CommonJS JS so they can
# run in the production image with `node` (tsx is a devDependency, absent
# from --prod). Every script listed here is invoked by apps/api/migrate.sh
# on each Cloud Run deploy — fail-soft, idempotent. The compiled .js files
# land next to their .ts sources; prisma/ is copied wholesale into the
# runner stage below so they ship intact.
#
# Two passes: (1) prisma/seeds/**/*.ts (preserves the closure-agents/
# and essay-harvest/ subdirectory layout under prisma/seeds/),
# (2) the four top-level prisma/seed-*.ts files.
RUN cd apps/api && npx tsc \
    prisma/seeds/seed-prediction-closure.ts \
    prisma/seeds/load-cds-bands.ts \
    prisma/seeds/load-top-cases.ts \
    prisma/seeds/seed-school-programs.ts \
    prisma/seeds/backfill-school-ranking-lists.ts \
    prisma/seeds/backfill-has-ea-ed2.ts \
    prisma/seeds/closure-agents/seed-closure-targets.ts \
    prisma/seeds/closure-agents/collect-school-rankings.ts \
    prisma/seeds/essay-harvest/import-essays.ts \
    prisma/seeds/essay-harvest/data-jhu.ts \
    prisma/seeds/essay-harvest/data-jhu2.ts \
    prisma/seeds/essay-harvest/data-jhu3.ts \
    prisma/seeds/essay-harvest/data-jhu4.ts \
    prisma/seeds/essay-harvest/data-hamilton.ts \
    prisma/seeds/essay-harvest/data-hamilton2.ts \
    prisma/seeds/essay-harvest/data-hamilton3.ts \
    prisma/seeds/essay-harvest/data-mit-harvard.ts \
    prisma/seeds/essay-harvest/data-prepmaven.ts \
    prisma/seeds/essay-harvest/data-collegevine.ts \
    prisma/seeds/essay-harvest/data-stanford-usc.ts \
    prisma/seeds/essay-harvest/data-final.ts \
    prisma/seeds/essay-harvest/data-collegeessayguy.ts \
    prisma/seeds/essay-harvest/data-shemmassian.ts \
    --module commonjs --target es2022 --moduleResolution node \
    --esModuleInterop --skipLibCheck --resolveJsonModule \
    --rootDir prisma/seeds --outDir prisma/seeds

# Pass 2 uses nodenext resolution because seed-high-schools.ts imports
# `@study-abroad/shared/scoring` (a subpath export from the shared
# package.json `exports` field, which only `node16` / `nodenext` /
# `bundler` resolvers honor). Output is still CommonJS at runtime
# (apps/api has no `"type": "module"`), so `node` runs the files fine.
RUN cd apps/api && npx tsc \
    prisma/seed-essay-prompts-v2.ts \
    prisma/seed-high-schools.ts \
    prisma/seed-activity-templates.ts \
    prisma/seed-assessment.ts \
    prisma/seed-hook-stats.ts \
    prisma/seed-global-admit-baselines.ts \
    --module nodenext --target es2022 --moduleResolution nodenext \
    --esModuleInterop --skipLibCheck --resolveJsonModule \
    --rootDir prisma --outDir prisma

# Deploy to /prod with all dependencies (pnpm deploy creates standalone package)
RUN pnpm --filter api deploy /prod --prod --legacy

# Copy Prisma client to deployed node_modules
RUN cp -r /app/node_modules/.pnpm/@prisma+client@*/node_modules/@prisma/client /prod/node_modules/@prisma/client && \
    cp -r /app/node_modules/.pnpm/@prisma+client@*/node_modules/.prisma /prod/node_modules/.prisma

# Copy shared package build output
RUN cp -r /app/packages/shared/dist /prod/node_modules/@study-abroad/shared/dist

# ============================================
# Stage 2: Production Runner
# ============================================
FROM node:26-alpine AS runner

# Install openssl for Prisma
RUN apk add --no-cache openssl

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

WORKDIR /app

# Copy deployed application with all dependencies
COPY --from=builder --chown=nestjs:nodejs /prod ./

# Copy built application
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./dist

# Copy Prisma schema and migrations for migrate deploy
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/prisma ./prisma

# Copy entrypoint and migration scripts
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/entrypoint.sh ./entrypoint.sh
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/migrate.sh ./migrate.sh
RUN chmod +x entrypoint.sh migrate.sh

# Run as non-root user
USER nestjs

# Default port 4101. Cloud providers may override via PORT env var.
EXPOSE 4101

# Health check — wget is available in alpine by default
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:4101/health/live || exit 1

# Start application (migrations run via Cloud Run Job before deploy)
CMD ["./entrypoint.sh"]
