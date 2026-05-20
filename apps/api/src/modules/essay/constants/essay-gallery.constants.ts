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
  // Carry the precomputed analysis cache through so analyzeGalleryEssay can
  // serve a hot read instantly when the caller didn't pass a schoolName
  // override. See essay-gallery.service.ts.
  aiAnalysisCache: true,
  school: { select: SCHOOL_NAME_RANK_SELECT },
} as const satisfies Prisma.AdmissionCaseSelect;
