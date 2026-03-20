-- Composite index for batch import dedup queries: WHERE (userId, source, schoolId)
CREATE INDEX "AdmissionCase_userId_source_schoolId_idx" ON "AdmissionCase"("userId", "source", "schoolId");

-- Composite index for batch history queries: ORDER BY importBatchId, createdAt
CREATE INDEX "AdmissionCase_importBatchId_createdAt_idx" ON "AdmissionCase"("importBatchId", "createdAt");
