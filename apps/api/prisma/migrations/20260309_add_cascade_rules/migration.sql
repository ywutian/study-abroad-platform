-- Fix foreign key cascade rules (from production readiness audit)
-- Each statement drops the old FK and recreates with correct onDelete behavior.

-- 1. Activity.activityTemplateId → ActivityTemplate (SetNull)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Activity_activityTemplateId_fkey') THEN
    ALTER TABLE "Activity" DROP CONSTRAINT "Activity_activityTemplateId_fkey";
  END IF;
  ALTER TABLE "Activity" ADD CONSTRAINT "Activity_activityTemplateId_fkey"
    FOREIGN KEY ("activityTemplateId") REFERENCES "ActivityTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Award.competitionId → Competition (SetNull)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Award_competitionId_fkey') THEN
    ALTER TABLE "Award" DROP CONSTRAINT "Award_competitionId_fkey";
  END IF;
  ALTER TABLE "Award" ADD CONSTRAINT "Award_competitionId_fkey"
    FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Education.highSchoolId → HighSchool (SetNull)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Education_highSchoolId_fkey') THEN
    ALTER TABLE "Education" DROP CONSTRAINT "Education_highSchoolId_fkey";
  END IF;
  ALTER TABLE "Education" ADD CONSTRAINT "Education_highSchoolId_fkey"
    FOREIGN KEY ("highSchoolId") REFERENCES "HighSchool"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4. ProfileTargetSchool.schoolId → School (Cascade)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ProfileTargetSchool_schoolId_fkey') THEN
    ALTER TABLE "ProfileTargetSchool" DROP CONSTRAINT "ProfileTargetSchool_schoolId_fkey";
  END IF;
  ALTER TABLE "ProfileTargetSchool" ADD CONSTRAINT "ProfileTargetSchool_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 5. AdmissionCase.schoolId → School (Cascade)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'AdmissionCase_schoolId_fkey') THEN
    ALTER TABLE "AdmissionCase" DROP CONSTRAINT "AdmissionCase_schoolId_fkey";
  END IF;
  ALTER TABLE "AdmissionCase" ADD CONSTRAINT "AdmissionCase_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 6. ForumPost.categoryId → ForumCategory (Restrict)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ForumPost_categoryId_fkey') THEN
    ALTER TABLE "ForumPost" DROP CONSTRAINT "ForumPost_categoryId_fkey";
  END IF;
  ALTER TABLE "ForumPost" ADD CONSTRAINT "ForumPost_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "ForumCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 7. EssayExample.schoolId → School (SetNull)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'EssayExample_schoolId_fkey') THEN
    ALTER TABLE "EssayExample" DROP CONSTRAINT "EssayExample_schoolId_fkey";
  END IF;
  ALTER TABLE "EssayExample" ADD CONSTRAINT "EssayExample_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 8. ApplicationTimeline.schoolId → School (Cascade)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ApplicationTimeline_schoolId_fkey') THEN
    ALTER TABLE "ApplicationTimeline" DROP CONSTRAINT "ApplicationTimeline_schoolId_fkey";
  END IF;
  ALTER TABLE "ApplicationTimeline" ADD CONSTRAINT "ApplicationTimeline_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 9. PersonalEvent.globalEventId → GlobalEvent (SetNull)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'PersonalEvent_globalEventId_fkey') THEN
    ALTER TABLE "PersonalEvent" DROP CONSTRAINT "PersonalEvent_globalEventId_fkey";
  END IF;
  ALTER TABLE "PersonalEvent" ADD CONSTRAINT "PersonalEvent_globalEventId_fkey"
    FOREIGN KEY ("globalEventId") REFERENCES "GlobalEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
