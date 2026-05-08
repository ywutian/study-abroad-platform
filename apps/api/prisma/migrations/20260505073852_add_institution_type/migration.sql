-- CreateEnum
CREATE TYPE "InstitutionType" AS ENUM ('RESEARCH_UNIVERSITY', 'LIBERAL_ARTS', 'ART_DESIGN', 'MUSIC_CONSERVATORY', 'SPECIALTY');

-- AlterTable
ALTER TABLE "School" ADD COLUMN "institutionType" "InstitutionType";
