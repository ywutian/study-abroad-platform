-- Pause/drain old Skill collectors before applying. Historical counts cannot
-- be reconstructed from the truncated legacy traceIds array. Preserve them and
-- mark pre-cutover rows consumed; retain the traces themselves for audit.
SET lock_timeout = '5s';
SET statement_timeout = '60s';

ALTER TABLE "AgentEvaluationTrace"
ADD COLUMN "skillSignalConsumedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

-- New traces must be claimed transactionally by the new collector.
ALTER TABLE "AgentEvaluationTrace"
ALTER COLUMN "skillSignalConsumedAt" DROP DEFAULT;

CREATE INDEX "AgentEvaluationTrace_skillSignalConsumedAt_createdAt_id_idx"
ON "AgentEvaluationTrace"("skillSignalConsumedAt", "createdAt", "id");

RESET statement_timeout;
RESET lock_timeout;
