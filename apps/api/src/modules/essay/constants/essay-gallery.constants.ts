import { Prisma, DataReviewStatus } from '@prisma/client';
import { SCHOOL_NAME_RANK_SELECT } from '../../../common/constants/prisma-selects';

export const CASE_PUBLIC_WHERE = {
  visibility: { in: ['PUBLIC', 'ANONYMOUS'] as any },
  essayContent: { not: null },
  reviewStatus: {
    in: [DataReviewStatus.AUTO_APPROVED, DataReviewStatus.APPROVED],
  },
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
