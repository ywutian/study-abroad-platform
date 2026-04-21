-- Allow applicant feedback to attach directly to ApplicationAnalysisRun
-- while preserving experiment-exposure feedback compatibility.

ALTER TABLE "ApplicationAnalysisFeedbackRecord"
  ALTER COLUMN "exposureRecordId" DROP NOT NULL,
  ALTER COLUMN "exposureId" DROP NOT NULL,
  ALTER COLUMN "capability" DROP NOT NULL;
