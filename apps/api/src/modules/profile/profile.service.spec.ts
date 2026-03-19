import { Test, TestingModule } from '@nestjs/testing';
import { ProfileService } from './profile.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ProfileCrudService } from './profile-crud.service';
import { ProfileScoresService } from './profile-scores.service';
import { ProfileEducationService } from './profile-education.service';
import { ProfileAnalysisService } from './profile-analysis.service';
import { ProfileMemoryService } from './profile-memory.service';
import { ProfileHelpersService } from './profile-helpers.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { Visibility, Role, Prisma } from '@prisma/client';

describe('ProfileService', () => {
  let service: ProfileService;
  let crudService: ProfileCrudService;
  let scoresService: ProfileScoresService;
  let _educationService: ProfileEducationService;
  let analysisService: ProfileAnalysisService;
  let memoryService: ProfileMemoryService;
  let _helpersService: ProfileHelpersService;

  const mockUserId = 'user-123';
  const mockProfileId = 'profile-123';

  const mockProfile = {
    id: mockProfileId,
    userId: mockUserId,
    realName: 'Test User',
    gpa: new Prisma.Decimal(3.8),
    gpaScale: new Prisma.Decimal(4.0),
    currentSchool: 'Test High School',
    currentSchoolType: 'PUBLIC_US',
    grade: 'JUNIOR',
    targetMajor: 'Computer Science',
    regionPref: ['US', 'UK'],
    budgetTier: 'HIGH',
    applicationRound: 'ED',
    visibility: Visibility.PRIVATE,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockTestScore = {
    id: 'score-123',
    profileId: mockProfileId,
    type: 'SAT',
    score: 1550,
    subScores: { reading: 780, math: 770 },
    testDate: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    profile: { userId: mockUserId },
  };

  const mockActivity = {
    id: 'activity-123',
    profileId: mockProfileId,
    name: 'Math Club',
    category: 'ACADEMIC',
    role: 'President',
    organization: 'School',
    description: 'Led math competitions',
    startDate: new Date('2023-09-01'),
    endDate: null,
    hoursPerWeek: 5,
    weeksPerYear: 40,
    isOngoing: true,
    order: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    profile: { userId: mockUserId },
  };

  const mockAward = {
    id: 'award-123',
    profileId: mockProfileId,
    name: 'AMC Gold',
    level: 'NATIONAL',
    year: 2024,
    description: 'Top 1%',
    order: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    profile: { userId: mockUserId },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileService,
        {
          provide: PrismaService,
          useValue: {
            activityTemplate: {
              findMany: jest.fn().mockResolvedValue([]),
            },
          },
        },
        {
          provide: ProfileCrudService,
          useValue: {
            findByUserId: jest.fn().mockResolvedValue(mockProfile),
            findByIdWithVisibilityCheck: jest
              .fn()
              .mockResolvedValue(mockProfile),
            create: jest.fn().mockResolvedValue(mockProfile),
            update: jest.fn().mockResolvedValue(mockProfile),
            upsert: jest.fn().mockResolvedValue(mockProfile),
          },
        },
        {
          provide: ProfileScoresService,
          useValue: {
            createTestScore: jest.fn().mockResolvedValue(mockTestScore),
            updateTestScore: jest.fn().mockResolvedValue({
              ...mockTestScore,
              score: 1600,
            }),
            deleteTestScore: jest.fn().mockResolvedValue(undefined),
            getTestScores: jest.fn().mockResolvedValue([mockTestScore]),
            createActivity: jest.fn().mockResolvedValue(mockActivity),
            updateActivity: jest.fn().mockResolvedValue({
              ...mockActivity,
              role: 'Vice President',
            }),
            deleteActivity: jest.fn().mockResolvedValue(undefined),
            getActivities: jest.fn().mockResolvedValue([mockActivity]),
            reorderActivities: jest.fn().mockResolvedValue(undefined),
            aiSortActivities: jest.fn().mockResolvedValue({
              suggestedOrder: [],
              summary: 'test',
            }),
            createAward: jest.fn().mockResolvedValue(mockAward),
            updateAward: jest.fn().mockResolvedValue({
              ...mockAward,
              description: 'Updated description',
            }),
            deleteAward: jest.fn().mockResolvedValue(undefined),
            getAwards: jest.fn().mockResolvedValue([mockAward]),
            reorderAwards: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: ProfileEducationService,
          useValue: {
            createEducation: jest.fn().mockResolvedValue({}),
            updateEducation: jest.fn().mockResolvedValue({}),
            deleteEducation: jest.fn().mockResolvedValue(undefined),
            getEducation: jest.fn().mockResolvedValue([]),
            getTargetSchools: jest.fn().mockResolvedValue([]),
            setTargetSchools: jest.fn().mockResolvedValue([]),
            addTargetSchool: jest.fn().mockResolvedValue({}),
            removeTargetSchool: jest.fn().mockResolvedValue(undefined),
            createEssay: jest.fn().mockResolvedValue({}),
            updateEssay: jest.fn().mockResolvedValue({}),
            deleteEssay: jest.fn().mockResolvedValue(undefined),
            getEssays: jest.fn().mockResolvedValue([]),
            getEssayById: jest.fn().mockResolvedValue({}),
          },
        },
        {
          provide: ProfileAnalysisService,
          useValue: {
            calculateProfileGrade: jest.fn().mockResolvedValue({
              overallScore: 50,
              admissionPrediction:
                'Building a strong profile - focus on key areas',
              strengths: [],
              weaknesses: [],
              improvements: [
                'Consider adding research experience',
                'Participate in leadership positions in your activities',
                'Pursue academic competitions in your field of interest',
              ],
              recommendedActivities: [
                'Join summer research programs at local universities',
                'Start a project or initiative related to your intended major',
                'Seek internship opportunities in your field',
              ],
              timeline: [
                { date: '3 months', task: 'Complete standardized testing' },
                { date: '6 months', task: 'Start college essays' },
                {
                  date: '9 months',
                  task: 'Finalize school list and applications',
                },
              ],
              projectedImprovement: 20,
            }),
          },
        },
        {
          provide: ProfileMemoryService,
          useValue: {
            recordProfileUpdateToMemory: jest.fn().mockResolvedValue(undefined),
            recordTestScoreToMemory: jest.fn().mockResolvedValue(undefined),
            recordActivityToMemory: jest.fn().mockResolvedValue(undefined),
            recordAwardToMemory: jest.fn().mockResolvedValue(undefined),
            recordEducationToMemory: jest.fn().mockResolvedValue(undefined),
            recordEssayToMemory: jest.fn().mockResolvedValue(undefined),
            recordTargetSchoolAddToMemory: jest
              .fn()
              .mockResolvedValue(undefined),
            recordTargetSchoolRemovalToMemory: jest
              .fn()
              .mockResolvedValue(undefined),
            recordSetTargetSchoolsToMemory: jest
              .fn()
              .mockResolvedValue(undefined),
          },
        },
        {
          provide: ProfileHelpersService,
          useValue: {
            getProfileId: jest.fn().mockResolvedValue(mockProfileId),
            verifyProfileOwnership: jest
              .fn()
              .mockImplementation((entity, userId, entityName) => {
                if (!entity) {
                  throw new NotFoundException(`${entityName} not found`);
                }
                if (entity.profile?.userId !== userId) {
                  throw new ForbiddenException(
                    `You don't have access to this ${entityName}`,
                  );
                }
                return entity;
              }),
          },
        },
      ],
    }).compile();

    service = module.get<ProfileService>(ProfileService);
    crudService = module.get<ProfileCrudService>(ProfileCrudService);
    scoresService = module.get<ProfileScoresService>(ProfileScoresService);
    _educationService = module.get<ProfileEducationService>(
      ProfileEducationService,
    );
    analysisService = module.get<ProfileAnalysisService>(
      ProfileAnalysisService,
    );
    memoryService = module.get<ProfileMemoryService>(ProfileMemoryService);
    _helpersService = module.get<ProfileHelpersService>(ProfileHelpersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================
  // Profile CRUD Tests
  // ============================================

  describe('findByUserId', () => {
    it('should return profile with all relations', async () => {
      const profileWithRelations = {
        ...mockProfile,
        testScores: [mockTestScore],
        activities: [mockActivity],
        awards: [mockAward],
        education: [],
        essays: [],
      };

      (crudService.findByUserId as jest.Mock).mockResolvedValue(
        profileWithRelations,
      );

      const result = await service.findByUserId(mockUserId);

      expect(result).toEqual(profileWithRelations);
      expect(crudService.findByUserId).toHaveBeenCalledWith(mockUserId);
    });

    it('should return null if profile not found', async () => {
      (crudService.findByUserId as jest.Mock).mockResolvedValue(null);

      const result = await service.findByUserId('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findByIdWithVisibilityCheck', () => {
    it('should return own profile regardless of visibility', async () => {
      const privateProfile = { ...mockProfile, visibility: Visibility.PRIVATE };
      (crudService.findByIdWithVisibilityCheck as jest.Mock).mockResolvedValue({
        ...privateProfile,
        user: { id: mockUserId },
      });

      const result = await service.findByIdWithVisibilityCheck(
        mockProfileId,
        mockUserId,
        Role.USER,
      );

      expect(result).toBeDefined();
    });

    it('should throw ForbiddenException for private profile viewed by others', async () => {
      (crudService.findByIdWithVisibilityCheck as jest.Mock).mockRejectedValue(
        new ForbiddenException('This profile is private'),
      );

      await expect(
        service.findByIdWithVisibilityCheck(
          mockProfileId,
          'other-user',
          Role.USER,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow ADMIN to view any profile', async () => {
      (crudService.findByIdWithVisibilityCheck as jest.Mock).mockResolvedValue({
        ...mockProfile,
        visibility: Visibility.PRIVATE,
        user: { id: mockUserId },
      });

      const result = await service.findByIdWithVisibilityCheck(
        mockProfileId,
        'admin-user',
        Role.ADMIN,
      );

      expect(result).toBeDefined();
    });

    it('should throw NotFoundException if profile not found', async () => {
      (crudService.findByIdWithVisibilityCheck as jest.Mock).mockRejectedValue(
        new NotFoundException('Profile not found'),
      );

      await expect(
        service.findByIdWithVisibilityCheck(
          'nonexistent',
          mockUserId,
          Role.USER,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for VERIFIED_ONLY profile viewed by non-verified user', async () => {
      (crudService.findByIdWithVisibilityCheck as jest.Mock).mockRejectedValue(
        new ForbiddenException('Only verified users can view this profile'),
      );

      await expect(
        service.findByIdWithVisibilityCheck(
          mockProfileId,
          'other-user',
          Role.USER,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('upsert', () => {
    it('should create or update profile', async () => {
      (crudService.upsert as jest.Mock).mockResolvedValue(mockProfile);

      const result = await service.upsert(mockUserId, {
        gpa: 3.9,
        targetMajor: 'Computer Science',
      });

      expect(result).toEqual(mockProfile);
      expect(crudService.upsert).toHaveBeenCalled();
    });
  });

  // ============================================
  // Test Scores Tests
  // ============================================

  describe('createTestScore', () => {
    it('should create test score', async () => {
      const result = await service.createTestScore(mockUserId, {
        type: 'SAT',
        score: 1550,
        subScores: { reading: 780, math: 770 },
      });

      expect(result).toEqual(mockTestScore);
      expect(scoresService.createTestScore).toHaveBeenCalledWith(
        mockUserId,
        expect.any(Object),
      );
    });

    it('should record to memory on create', async () => {
      await service.createTestScore(mockUserId, {
        type: 'SAT',
        score: 1550,
      });

      // Memory recording is async (fire-and-forget), give it a tick
      await new Promise((resolve) => setImmediate(resolve));

      expect(memoryService.recordTestScoreToMemory).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({ type: 'SAT', score: 1550 }),
      );
    });
  });

  describe('updateTestScore', () => {
    it('should update test score', async () => {
      const result = await service.updateTestScore(mockUserId, 'score-123', {
        score: 1600,
      });

      expect(result.score).toBe(1600);
      expect(scoresService.updateTestScore).toHaveBeenCalledWith(
        mockUserId,
        'score-123',
        { score: 1600 },
      );
    });

    it('should throw NotFoundException if score not found', async () => {
      (scoresService.updateTestScore as jest.Mock).mockRejectedValue(
        new NotFoundException('Test score not found'),
      );

      await expect(
        service.updateTestScore(mockUserId, 'nonexistent', { score: 1600 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if score belongs to another user', async () => {
      (scoresService.updateTestScore as jest.Mock).mockRejectedValue(
        new ForbiddenException("You don't have access to this Test score"),
      );

      await expect(
        service.updateTestScore(mockUserId, 'score-123', { score: 1600 }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deleteTestScore', () => {
    it('should delete test score', async () => {
      await service.deleteTestScore(mockUserId, 'score-123');

      expect(scoresService.deleteTestScore).toHaveBeenCalledWith(
        mockUserId,
        'score-123',
      );
    });
  });

  // ============================================
  // Activities Tests
  // ============================================

  describe('createActivity', () => {
    it('should create activity', async () => {
      const result = await service.createActivity(mockUserId, {
        name: 'Math Club',
        category: 'ACADEMIC',
        role: 'President',
      });

      expect(result).toEqual(mockActivity);
      expect(scoresService.createActivity).toHaveBeenCalledWith(
        mockUserId,
        expect.any(Object),
      );
    });
  });

  describe('updateActivity', () => {
    it('should update activity', async () => {
      const result = await service.updateActivity(mockUserId, 'activity-123', {
        role: 'Vice President',
      });

      expect(result.role).toBe('Vice President');
    });

    it('should throw NotFoundException if activity not found', async () => {
      (scoresService.updateActivity as jest.Mock).mockRejectedValue(
        new NotFoundException('Activity not found'),
      );

      await expect(
        service.updateActivity(mockUserId, 'nonexistent', { role: 'Member' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteActivity', () => {
    it('should delete activity', async () => {
      await service.deleteActivity(mockUserId, 'activity-123');

      expect(scoresService.deleteActivity).toHaveBeenCalledWith(
        mockUserId,
        'activity-123',
      );
    });
  });

  // ============================================
  // Awards Tests
  // ============================================

  describe('createAward', () => {
    it('should create award', async () => {
      const result = await service.createAward(mockUserId, {
        name: 'AMC Gold',
        level: 'NATIONAL',
        year: 2024,
      });

      expect(result).toEqual(mockAward);
      expect(scoresService.createAward).toHaveBeenCalledWith(
        mockUserId,
        expect.any(Object),
      );
    });
  });

  describe('updateAward', () => {
    it('should update award', async () => {
      const result = await service.updateAward(mockUserId, 'award-123', {
        description: 'Updated description',
      });

      expect(result.description).toBe('Updated description');
    });

    it('should throw NotFoundException if award not found', async () => {
      (scoresService.updateAward as jest.Mock).mockRejectedValue(
        new NotFoundException('Award not found'),
      );

      await expect(
        service.updateAward(mockUserId, 'nonexistent', {
          description: 'Test',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteAward', () => {
    it('should delete award', async () => {
      await service.deleteAward(mockUserId, 'award-123');

      expect(scoresService.deleteAward).toHaveBeenCalledWith(
        mockUserId,
        'award-123',
      );
    });
  });

  // ============================================
  // calculateProfileGrade (delegated to ProfileAnalysisService)
  // ============================================
  describe('calculateProfileGrade', () => {
    it('should return base score when profile not found', async () => {
      const result = await service.calculateProfileGrade(mockUserId);
      expect(result.overallScore).toBe(50);
      expect(analysisService.calculateProfileGrade).toHaveBeenCalledWith(
        mockUserId,
      );
    });

    it('should score high GPA profile correctly', async () => {
      (analysisService.calculateProfileGrade as jest.Mock).mockResolvedValue({
        overallScore: 95,
        admissionPrediction: 'Strong candidate for top universities',
        strengths: [
          'Excellent GPA above 3.6',
          'Strong SAT score: 1550',
          'Diverse extracurricular involvement (5 activities)',
          'Multiple awards and recognitions (3)',
        ],
        weaknesses: [],
        improvements: [],
        recommendedActivities: [],
        timeline: [],
        projectedImprovement: 5,
      });

      const result = await service.calculateProfileGrade(mockUserId);
      expect(result.overallScore).toBeGreaterThanOrEqual(85);
      expect(result.strengths).toEqual(
        expect.arrayContaining([
          expect.stringContaining('GPA'),
          expect.stringContaining('SAT'),
        ]),
      );
    });

    it('should cap overall score at 100', async () => {
      (analysisService.calculateProfileGrade as jest.Mock).mockResolvedValue({
        overallScore: 100,
        admissionPrediction: 'Strong candidate for top universities',
        strengths: [],
        weaknesses: [],
        improvements: [],
        recommendedActivities: [],
        timeline: [],
        projectedImprovement: 0,
      });

      const result = await service.calculateProfileGrade(mockUserId);
      expect(result.overallScore).toBeLessThanOrEqual(100);
    });

    it('should identify weaknesses for empty profile', async () => {
      (analysisService.calculateProfileGrade as jest.Mock).mockResolvedValue({
        overallScore: 50,
        admissionPrediction: 'Building a strong profile - focus on key areas',
        strengths: [],
        weaknesses: [
          'GPA not recorded',
          'No extracurricular activities recorded',
        ],
        improvements: [],
        recommendedActivities: [],
        timeline: [],
        projectedImprovement: 20,
      });

      const result = await service.calculateProfileGrade(mockUserId);
      expect(result.weaknesses).toEqual(
        expect.arrayContaining([
          'GPA not recorded',
          'No extracurricular activities recorded',
        ]),
      );
    });

    it('should always return timeline and improvement suggestions', async () => {
      const result = await service.calculateProfileGrade(mockUserId);
      expect(result.timeline).toHaveLength(3);
      expect(result.improvements).toHaveLength(3);
      expect(result.recommendedActivities).toHaveLength(3);
      expect(result.projectedImprovement).toBeGreaterThanOrEqual(0);
    });
  });
});
