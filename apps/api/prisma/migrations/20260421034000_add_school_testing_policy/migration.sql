DO $$ BEGIN
  CREATE TYPE "TestingPolicy" AS ENUM ('REQUIRED', 'OPTIONAL', 'BLIND', 'UNKNOWN');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "School"
  ADD COLUMN IF NOT EXISTS "testingPolicy" "TestingPolicy" NOT NULL DEFAULT 'UNKNOWN';

UPDATE "School"
SET "testingPolicy" = 'OPTIONAL'
WHERE "testOptional" = true
  AND "testingPolicy" = 'UNKNOWN';

UPDATE "School"
SET "testingPolicy" = 'REQUIRED'
WHERE "testOptional" = false
  AND "testingPolicy" = 'UNKNOWN';

UPDATE "School"
SET "testingPolicy" = 'BLIND'
WHERE "name" IN (
  'University of California, Berkeley',
  'University of California, Los Angeles',
  'University of California, San Diego',
  'University of California, Davis',
  'University of California, Irvine',
  'University of California, Santa Barbara',
  'University of California, Santa Cruz',
  'University of California, Riverside',
  'University of California, Merced'
);

CREATE INDEX IF NOT EXISTS "School_testingPolicy_idx" ON "School"("testingPolicy");
