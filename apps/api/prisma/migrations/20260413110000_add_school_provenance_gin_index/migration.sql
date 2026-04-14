CREATE INDEX IF NOT EXISTS "idx_school_provenance_tier"
ON "School"
USING GIN (("metadata"->'provenance'));
