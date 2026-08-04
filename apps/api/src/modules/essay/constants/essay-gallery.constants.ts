import { Prisma } from '@prisma/client';
import {
  CASE_PUBLIC_VISIBILITY_WHERE,
  SCHOOL_NAME_RANK_SELECT,
} from '../../../common/constants/prisma-selects';

/**
 * The gallery's slice of the shared public-case filter: same visibility and
 * review rules as everywhere else, plus "has an essay to show".
 *
 * It used to restate all three clauses, with the visibility half written as
 * string literals behind `as any` — so neither the enum nor the compiler could
 * tell it apart from a typo, and a change to the shared set would not reach it.
 * Only the `essayContent` predicate is this surface's own; the rest is spread.
 */
export const CASE_PUBLIC_WHERE = {
  ...CASE_PUBLIC_VISIBILITY_WHERE,
  essayContent: { not: null },
};

export const GALLERY_LIST_SELECT = {
  id: true,
  year: true,
  result: true,
  essayType: true,
  essayPrompt: true,
  essayContent: true,
  promptNumber: true,
  gpaRange: true,
  satRange: true,
  tags: true,
  isVerified: true,
  // Provenance — populated by PR 2. Service backfills from `tags` on read
  // when these columns are null on legacy rows so the gallery can render
  // the "查看原文 →" trust signal without a separate migration pass.
  sourceArchive: true,
  sourceUrl: true,
  sourceAuthor: true,
  createdAt: true,
  school: { select: SCHOOL_NAME_RANK_SELECT },
} as const satisfies Prisma.AdmissionCaseSelect;

export const GALLERY_DETAIL_SELECT = {
  id: true,
  year: true,
  round: true,
  result: true,
  essayType: true,
  essayPrompt: true,
  essayContent: true,
  promptNumber: true,
  gpaRange: true,
  satRange: true,
  tags: true,
  isVerified: true,
  visibility: true,
  // Provenance — see note above.
  sourceArchive: true,
  sourceUrl: true,
  sourceAuthor: true,
  // Self-reflection — only meaningful for rejected/waitlisted self-uploads
  // (the "文书避雷" tab). Null on every harvested essay.
  selfReflection: true,
  // Carry the precomputed analysis cache through so analyzeGalleryEssay can
  // serve a hot read instantly when the caller didn't pass a schoolName
  // override. See essay-gallery.service.ts.
  aiAnalysisCache: true,
  school: { select: SCHOOL_NAME_RANK_SELECT },
} as const satisfies Prisma.AdmissionCaseSelect;
