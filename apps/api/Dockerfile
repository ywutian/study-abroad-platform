# ============================================
# Stage 1: Build
# ============================================
FROM node:20-alpine AS builder

# Install pnpm and openssl (upgrade the base libs to stay off the Trivy HIGH CVE list)
RUN corepack enable && corepack prepare pnpm@10.22.0 --activate
RUN apk add --no-cache --upgrade \
    'openssl>=3.5.8-r0' 'libcrypto3>=3.5.8-r0' 'libssl3>=3.5.8-r0'

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
# on each Cloud Run deploy. Most seeds are fail-soft; the user-visible
# empty-page set (see SEED_FAIL_HARD_LABELS in migrate.sh) is fail-hard, and
# prisma/check-seed-result-assertions.ts then counts the rows (exit 42).
# The compiled .js files land next to their .ts sources; prisma/ is copied
# wholesale into the runner stage below so they ship intact.
#
# Two passes: (1) prisma/seeds/**/*.ts (preserves the closure-agents/
# and essay-harvest/ subdirectory layout under prisma/seeds/),
# (2) the top-level prisma/seed-*.ts files (must match migrate.sh run_seed;
#     enforced by scripts/check-seed-pipeline-parity.ts).
RUN cd apps/api && npx tsc \
    prisma/seeds/seed-prediction-closure.ts \
    prisma/seeds/load-cds-bands.ts \
    prisma/seeds/load-top-cases.ts \
    prisma/seeds/seed-school-programs.ts \
    prisma/seeds/backfill-school-ranking-lists.ts \
    prisma/seeds/backfill-has-ea-ed2.ts \
    prisma/seeds/upsert-global-events.ts \
    prisma/seeds/upsert-competition-data.ts \
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
    prisma/seed-intl-rate-correction.ts \
    prisma/seed-round-rate-correction.ts \
    prisma/seed-audit-corrections-2026-05-31.ts \
    prisma/seed-instate-rate-2026-05-31.ts \
    prisma/seed-testing-policy-2026-07-25.ts \
    prisma/seed-competitions.ts \
    prisma/seed-match-pools.ts \
    prisma/seed-forum-communities.ts \
    prisma/check-seed-result-assertions.ts \
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
FROM node:20-alpine AS runner

# Install openssl for Prisma — `--upgrade` bumps the base image's already-installed
# libcrypto3/libssl3/openssl past CVE-2026-14456 (fixed 3.5.8-r0).
# A plain `apk add openssl` leaves the vulnerable base packages in place; this is the
# image that ships + gets scanned, so it must carry the patched libs.
RUN apk add --no-cache --upgrade \
    'openssl>=3.5.8-r0' 'libcrypto3>=3.5.8-r0' 'libssl3>=3.5.8-r0'

# Upgrade the base image's own bundled npm, for the same reason as the apk line
# above: it ships in the scanned image. node:20-alpine bundles npm 10, whose
# vendored copies of tar (6.2.1) and brace-expansion (2.0.1) carry
# CVE-2026-59873 (CRITICAL), CVE-2026-59874 and CVE-2026-13149, and whose
# sigstore (2.3.1) carries CVE-2026-48815. None are reachable — the runtime is
# `node dist/main.js` and npm never installs anything in the container — but
# they are also trivially removable, and silencing four unreachable-but-fixable
# findings would have meant four permanent .trivyignore entries: the fix for all
# of them is in npm 11, and Node 20 stays on the npm 10 line, so the "will clear
# itself when the base image bumps npm" trigger written on the old sigstore
# entry could never actually fire while engines.node is pinned to 20.x.
#
# npm 11 requires Node ^20.17.0; this base is 20.19.x. If that ever stops
# holding, this line fails at build time rather than at deploy time. Pin npm so
# rebuilding the same commit is deterministic. npm 11.19.0 still bundles
# tar 7.5.19 (CVE-2026-73566); replace that nested runtime dependency with the
# patched 7.5.22 release instead of suppressing the image scanner finding.
#
# npm itself must stay: migrate.sh runs `npx prisma migrate deploy` as a Cloud
# Run Job from this image.
RUN npm install -g npm@11.19.0 && \
    mkdir -p /tmp/npm-tar && \
    npm pack tar@7.5.22 --pack-destination /tmp/npm-tar >/dev/null && \
    rm -rf /usr/local/lib/node_modules/npm/node_modules/tar && \
    mkdir -p /usr/local/lib/node_modules/npm/node_modules/tar && \
    tar -xzf /tmp/npm-tar/tar-7.5.22.tgz \
      -C /usr/local/lib/node_modules/npm/node_modules/tar \
      --strip-components=1 && \
    rm -rf /tmp/npm-tar

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
