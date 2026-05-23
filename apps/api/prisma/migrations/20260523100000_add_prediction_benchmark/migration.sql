-- M3 Prediction Benchmark: admin co-review surface
-- Each row captures one structural + case-replay benchmark run.
-- comments table holds free-form review threads from multiple admins.

CREATE TABLE "PredictionBenchmarkRun" (
    "id"            TEXT NOT NULL,
    "ranAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "label"         TEXT,
    "engineVersion" TEXT,
    "testsPassed"   INTEGER NOT NULL,
    "testsTotal"    INTEGER NOT NULL,
    "summary"       JSONB NOT NULL,
    "tests"         JSONB NOT NULL,
    "cases"         JSONB NOT NULL,
    "notes"         TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PredictionBenchmarkRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PredictionBenchmarkRun_ranAt_idx" ON "PredictionBenchmarkRun"("ranAt" DESC);

CREATE TABLE "PredictionBenchmarkComment" (
    "id"        TEXT NOT NULL,
    "runId"     TEXT NOT NULL,
    "authorId"  TEXT NOT NULL,
    "body"      TEXT NOT NULL,
    "anchor"    TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PredictionBenchmarkComment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PredictionBenchmarkComment_runId_createdAt_idx"
    ON "PredictionBenchmarkComment"("runId", "createdAt");

CREATE INDEX "PredictionBenchmarkComment_authorId_idx"
    ON "PredictionBenchmarkComment"("authorId");

ALTER TABLE "PredictionBenchmarkComment"
    ADD CONSTRAINT "PredictionBenchmarkComment_runId_fkey"
    FOREIGN KEY ("runId") REFERENCES "PredictionBenchmarkRun"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PredictionBenchmarkComment"
    ADD CONSTRAINT "PredictionBenchmarkComment_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
