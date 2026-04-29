-- Add structured fields for team recruitment card highlights.
ALTER TABLE "TestScore" ADD COLUMN "subject" TEXT;

ALTER TABLE "TeamRecruitmentMemberProfile"
  ADD COLUMN "showAcademics" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "showExperiences" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "showPersonality" BOOLEAN NOT NULL DEFAULT false;
