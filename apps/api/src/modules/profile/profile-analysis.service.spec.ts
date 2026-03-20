import { Test, TestingModule } from '@nestjs/testing';
import { ProfileAnalysisService } from './profile-analysis.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ProfileCrudService } from './profile-crud.service';
import { Prisma } from '@prisma/client';

describe('ProfileAnalysisService', () => {
  let service: ProfileAnalysisService;

  const mockPrisma = {
    profile: {
      findUnique: jest.fn(),
    },
  };

  const mockCrudService = {
    findByUserId: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileAnalysisService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ProfileCrudService, useValue: mockCrudService },
      ],
    }).compile();

    service = module.get<ProfileAnalysisService>(ProfileAnalysisService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================
  // calculateProfileGrade
  // ============================================

  describe('calculateProfileGrade', () => {
    it('should return base score of 50 when no profile exists', async () => {
      mockCrudService.findByUserId.mockResolvedValue(null);

      const result = await service.calculateProfileGrade('user-1');

      expect(result.overallScore).toBe(50);
      expect(result.strengths).toEqual([]);
      expect(result.weaknesses).toEqual([]);
    });

    it('should score high for strong profile with GPA, SAT, activities, awards', async () => {
      mockCrudService.findByUserId.mockResolvedValue({
        gpa: new Prisma.Decimal(3.9),
        gpaScale: new Prisma.Decimal(4.0),
        testScores: [
          { type: 'SAT', score: 1500 },
          { type: 'TOEFL', score: 115 },
        ],
        activities: Array(6).fill({ id: 'act' }),
        awards: Array(4).fill({ id: 'award' }),
      });

      const result = await service.calculateProfileGrade('user-1');

      // 50 base + 15 (GPA 97.5%) + 10 (SAT 1500) + 5 (TOEFL 115) + 10 (6 activities) + 10 (4 awards) = 100
      expect(result.overallScore).toBe(100);
      expect(result.admissionPrediction).toContain('Strong candidate');
      expect(result.strengths.length).toBeGreaterThanOrEqual(3);
    });

    it('should add weaknesses for missing fields', async () => {
      mockCrudService.findByUserId.mockResolvedValue({
        gpa: null,
        gpaScale: null,
        testScores: [],
        activities: [],
        awards: [],
      });

      const result = await service.calculateProfileGrade('user-1');

      expect(result.overallScore).toBe(50);
      expect(result.weaknesses).toContain('GPA not recorded');
      expect(result.weaknesses).toContain(
        'No extracurricular activities recorded',
      );
    });

    it('should cap score at 100', async () => {
      mockCrudService.findByUserId.mockResolvedValue({
        gpa: new Prisma.Decimal(3.95),
        gpaScale: new Prisma.Decimal(4.0),
        testScores: [
          { type: 'SAT', score: 1550 },
          { type: 'TOEFL', score: 118 },
        ],
        activities: Array(10).fill({ id: 'act' }),
        awards: Array(5).fill({ id: 'award' }),
      });

      const result = await service.calculateProfileGrade('user-1');

      expect(result.overallScore).toBeLessThanOrEqual(100);
    });

    it('should return moderate prediction for mid-range score', async () => {
      mockCrudService.findByUserId.mockResolvedValue({
        gpa: new Prisma.Decimal(3.2),
        gpaScale: new Prisma.Decimal(4.0),
        testScores: [{ type: 'SAT', score: 1300 }],
        activities: [{ id: 'act-1' }, { id: 'act-2' }],
        awards: [],
      });

      const result = await service.calculateProfileGrade('user-1');

      // 50 + 10 (GPA 80%) + 5 (SAT < 1400) + 4 (2 activities * 2) = 69
      expect(result.overallScore).toBe(69);
      expect(result.admissionPrediction).toContain('Competitive applicant');
    });

    it('should always include improvement suggestions and timeline', async () => {
      mockCrudService.findByUserId.mockResolvedValue(null);

      const result = await service.calculateProfileGrade('user-1');

      expect(result.improvements.length).toBeGreaterThan(0);
      expect(result.recommendedActivities.length).toBeGreaterThan(0);
      expect(result.timeline.length).toBeGreaterThan(0);
      expect(result.projectedImprovement).toBeGreaterThan(0);
    });
  });

  // ============================================
  // calculateCompleteness
  // ============================================

  describe('calculateCompleteness', () => {
    it('should return 0 score when no profile exists', async () => {
      mockPrisma.profile.findUnique.mockResolvedValue(null);

      const result = await service.calculateCompleteness('user-1');

      expect(result.score).toBe(0);
      for (const section of Object.values(result.sections)) {
        expect(section.missing).toContain('Profile not created');
      }
    });

    it('should calculate full score for complete profile', async () => {
      mockPrisma.profile.findUnique.mockResolvedValue({
        nickname: 'John',
        bio: 'Student',
        grade: '12',
        nationality: 'US',
        gpa: new Prisma.Decimal(3.8),
        currentSchool: 'Phillips',
        currentSchoolType: 'BOARDING',
        targetMajor: 'CS',
        educationSystem: 'US',
        testScores: [
          { type: 'SAT', score: 1500 },
          { type: 'TOEFL', score: 110 },
        ],
        activities: Array(15).fill({ id: 'a' }),
        budgetTier: 'HIGH',
        regionPref: ['northeast'],
        applicationRound: 'ED',
        needsFinancialAid: false,
        countryOfResidence: 'US',
        citizenship: 'US',
        firstGeneration: false,
      });

      const result = await service.calculateCompleteness('user-1');

      expect(result.score).toBe(100);
      expect(result.sections.basics.score).toBe(20);
      expect(result.sections.academics.score).toBe(25);
      expect(result.sections.testing.score).toBe(20);
      expect(result.sections.activities.score).toBe(15);
      expect(result.sections.preferences.score).toBe(10);
      expect(result.sections.demographics.score).toBe(10);
    });

    it('should identify missing sections accurately', async () => {
      mockPrisma.profile.findUnique.mockResolvedValue({
        nickname: 'John',
        bio: null,
        grade: '11',
        nationality: null,
        gpa: null,
        currentSchool: null,
        currentSchoolType: null,
        targetMajor: 'Engineering',
        educationSystem: null,
        testScores: [],
        activities: [],
        budgetTier: null,
        regionPref: [],
        applicationRound: null,
        needsFinancialAid: null,
        countryOfResidence: null,
        citizenship: null,
        firstGeneration: false,
      });

      const result = await service.calculateCompleteness('user-1');

      expect(result.sections.basics.missing).toContain('bio');
      expect(result.sections.basics.missing).toContain('nationality');
      expect(result.sections.academics.missing).toContain('gpa');
      expect(result.sections.testing.missing).toContain('testScores');
      expect(result.sections.activities.missing).toContain('activities');
    });

    it('should cap activities score at 15', async () => {
      mockPrisma.profile.findUnique.mockResolvedValue({
        nickname: null,
        bio: null,
        grade: null,
        nationality: null,
        gpa: null,
        currentSchool: null,
        currentSchoolType: null,
        targetMajor: null,
        educationSystem: null,
        testScores: [],
        activities: Array(20).fill({ id: 'a' }),
        budgetTier: null,
        regionPref: [],
        applicationRound: null,
        needsFinancialAid: null,
        countryOfResidence: null,
        citizenship: null,
        firstGeneration: false,
      });

      const result = await service.calculateCompleteness('user-1');

      expect(result.sections.activities.score).toBe(15);
    });
  });
});
