-- Store five-year scalar history without overwriting the latest service value
-- on School. This table is intentionally generic because the data marathon
-- covers many scalar display and prediction fields.
CREATE TABLE "SchoolHistoricalData" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "field" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "value" JSONB NOT NULL,
  "source" TEXT NOT NULL,
  "confidence" TEXT NOT NULL DEFAULT 'LOW',
  "staleness" TEXT NOT NULL,
  "sourceUrl" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SchoolHistoricalData_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SchoolHistoricalData_schoolId_field_year_source_key"
  ON "SchoolHistoricalData"("schoolId", "field", "year", "source");

CREATE INDEX "SchoolHistoricalData_schoolId_field_year_idx"
  ON "SchoolHistoricalData"("schoolId", "field", "year");

CREATE INDEX "SchoolHistoricalData_field_year_idx"
  ON "SchoolHistoricalData"("field", "year");

ALTER TABLE "SchoolHistoricalData"
  ADD CONSTRAINT "SchoolHistoricalData_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Rolling admissions can have no fixed date. We still keep the row so the
-- timeline/accounting system is complete without inventing a fake deadline.
ALTER TABLE "SchoolDeadline" ALTER COLUMN "applicationDeadline" DROP NOT NULL;
