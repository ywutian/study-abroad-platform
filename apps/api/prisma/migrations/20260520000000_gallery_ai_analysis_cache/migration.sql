-- Precomputed paragraph analysis cache for the public essay gallery.
-- Nullable + no default = zero-downtime ADD COLUMN, safe on a hot table.
-- Backfill happens via `pnpm precompute:gallery-analysis` (NOT migrate.sh —
-- Cloud Run task hits the 300s ceiling on 190 essays × 2 locales).

-- AlterTable
ALTER TABLE "AdmissionCase" ADD COLUMN     "aiAnalysisCache" JSONB;
