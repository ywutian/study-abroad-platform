import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CaseSimilarityService } from './case-similarity.service';
import { PrismaService } from '../../prisma/prisma.service';

/** Build a fake AdmissionCase row. */
function caseRow(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'c-' + Math.random().toString(36).slice(2, 8),
    year: 2025,
    round: 'RD',
    result: 'ADMITTED',
    gpaRange: '3.8-3.9',
    satRange: '1500-1550',
    major: 'Computer Science',
    tags: [],
    demographicTags: [],
    nationality: 'China',
    activities: [],
    school: { name: 'MIT', nameZh: '麻省理工' },
    ...over,
  };
}

describe('CaseSimilarityService', () => {
  let service: CaseSimilarityService;
  let prisma: {
    profile: { findUnique: jest.Mock };
    admissionCase: { findMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      profile: { findUnique: jest.fn() },
      admissionCase: { findMany: jest.fn() },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CaseSimilarityService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(CaseSimilarityService);
  });

  const profile = {
    gpa: 3.85,
    gpaScale: 4.0,
    targetMajor: 'Computer Science',
    nationality: 'China',
  };

  it('throws BadRequestException when the user has no profile', async () => {
    prisma.profile.findUnique.mockResolvedValue(null);
    await expect(service.findSimilar('u-1', {})).rejects.toThrow(
      BadRequestException,
    );
  });

  it('returns OK with a breakdown when >= 5 cases match', async () => {
    prisma.profile.findUnique.mockResolvedValue(profile);
    // limit:5 → take=5, the 5 same-nationality rows fill it (no fallback call).
    prisma.admissionCase.findMany.mockResolvedValueOnce([
      caseRow({ result: 'ADMITTED' }),
      caseRow({ result: 'ADMITTED' }),
      caseRow({ result: 'REJECTED' }),
      caseRow({ result: 'REJECTED' }),
      caseRow({ result: 'WAITLISTED' }),
    ]);

    const res = await service.findSimilar('u-1', { limit: 5 }, 'en');

    expect(res.status).toBe('OK');
    expect(res.count).toBe(5);
    expect(res.breakdown).toEqual({ admitted: 2, rejected: 2, waitlisted: 1 });
    expect(res.nationalityMatched).toBe(true);
    expect(res.cases[0].school).toBe('MIT'); // en locale
  });

  it('flags INSUFFICIENT_DATA when fewer than 5 cases match', async () => {
    prisma.profile.findUnique.mockResolvedValue(profile);
    // 2 same-nationality, 0 fallback → 2 total.
    prisma.admissionCase.findMany
      .mockResolvedValueOnce([caseRow(), caseRow()])
      .mockResolvedValueOnce([]);

    const res = await service.findSimilar('u-1', {});
    expect(res.status).toBe('INSUFFICIENT_DATA');
    expect(res.count).toBe(2);
    expect(res.minRequired).toBe(5);
  });

  it('falls back to cross-nationality cases and flags nationalityMatched false', async () => {
    prisma.profile.findUnique.mockResolvedValue(profile);
    // 1st call (same-nationality) under-fills; 2nd call (fallback) tops up.
    prisma.admissionCase.findMany
      .mockResolvedValueOnce([caseRow({ id: 'cn-1', nationality: 'China' })])
      .mockResolvedValueOnce([
        caseRow({ id: 'us-1', nationality: 'United States' }),
        caseRow({ id: 'us-2', nationality: 'United States' }),
      ]);

    const res = await service.findSimilar('u-1', {});
    expect(res.count).toBe(3);
    expect(res.nationalityMatched).toBe(false);
  });

  it('passes a schoolId filter through to the query', async () => {
    prisma.profile.findUnique.mockResolvedValue(profile);
    prisma.admissionCase.findMany.mockResolvedValue([]);

    await service.findSimilar('u-1', { schoolId: 'school-9' });

    expect(prisma.admissionCase.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ schoolId: 'school-9' }),
      }),
    );
  });
});
