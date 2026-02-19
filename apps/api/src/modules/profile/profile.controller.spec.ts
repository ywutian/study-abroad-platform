import { Test, TestingModule } from '@nestjs/testing';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { AiService } from '../ai/ai.service';
import { SchoolListService } from '../school-list/school-list.service';

describe('ProfileController', () => {
  let controller: ProfileController;
  let profileService: ProfileService;
  let aiService: AiService;
  let schoolListService: SchoolListService;

  const mockUser = { id: 'user-1', email: 'test@test.com', role: 'USER' };

  const mockProfile = {
    id: 'profile-1',
    userId: 'user-1',
    gpa: 3.8,
    gpaScale: 4.0,
    targetMajor: 'CS',
  };

  const mockTestScore = { id: 'ts-1', type: 'SAT', score: 1500 };
  const mockActivity = {
    id: 'act-1',
    name: 'Debate Club',
    category: 'ACADEMIC',
    role: 'President',
  };
  const mockAward = { id: 'aw-1', name: 'Science Olympiad', level: 'NATIONAL' };
  const mockEssay = {
    id: 'essay-1',
    title: 'My Story',
    content: 'Once upon a time...',
  };
  const mockEducation = {
    id: 'edu-1',
    school: 'Test High School',
    degree: 'HIGH_SCHOOL',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProfileController],
      providers: [
        {
          provide: ProfileService,
          useValue: {
            findByUserId: jest.fn().mockResolvedValue(mockProfile),
            upsert: jest.fn().mockResolvedValue(mockProfile),
            findByIdWithVisibilityCheck: jest
              .fn()
              .mockResolvedValue(mockProfile),
            calculateProfileGrade: jest
              .fn()
              .mockResolvedValue({ overall: 'B+', score: 85 }),
            getTestScores: jest.fn().mockResolvedValue([mockTestScore]),
            createTestScore: jest.fn().mockResolvedValue(mockTestScore),
            updateTestScore: jest.fn().mockResolvedValue(mockTestScore),
            deleteTestScore: jest.fn().mockResolvedValue(undefined),
            getActivities: jest.fn().mockResolvedValue([mockActivity]),
            createActivity: jest.fn().mockResolvedValue(mockActivity),
            updateActivity: jest.fn().mockResolvedValue(mockActivity),
            deleteActivity: jest.fn().mockResolvedValue(undefined),
            reorderActivities: jest.fn().mockResolvedValue(undefined),
            getAwards: jest.fn().mockResolvedValue([mockAward]),
            createAward: jest.fn().mockResolvedValue(mockAward),
            updateAward: jest.fn().mockResolvedValue(mockAward),
            deleteAward: jest.fn().mockResolvedValue(undefined),
            reorderAwards: jest.fn().mockResolvedValue(undefined),
            getEssays: jest.fn().mockResolvedValue([mockEssay]),
            getEssayById: jest.fn().mockResolvedValue(mockEssay),
            createEssay: jest.fn().mockResolvedValue(mockEssay),
            updateEssay: jest.fn().mockResolvedValue(mockEssay),
            deleteEssay: jest.fn().mockResolvedValue(undefined),
            getEducation: jest.fn().mockResolvedValue([mockEducation]),
            createEducation: jest.fn().mockResolvedValue(mockEducation),
            updateEducation: jest.fn().mockResolvedValue(mockEducation),
            deleteEducation: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: AiService,
          useValue: {
            analyzeProfileDetailed: jest
              .fn()
              .mockResolvedValue({ overall: 'GREEN' }),
          },
        },
        {
          provide: SchoolListService,
          useValue: {
            getUserSchoolList: jest.fn().mockResolvedValue([]),
            addSchool: jest
              .fn()
              .mockResolvedValue({ id: 'sl-1', schoolId: 'school-1' }),
            removeItem: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    controller = module.get<ProfileController>(ProfileController);
    profileService = module.get<ProfileService>(ProfileService);
    aiService = module.get<AiService>(AiService);
    schoolListService = module.get<SchoolListService>(SchoolListService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================
  // Profile
  // ============================================

  describe('getMyProfile', () => {
    it('should return the current user profile', async () => {
      const result = await controller.getMyProfile(mockUser as any);

      expect(profileService.findByUserId).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(mockProfile);
    });
  });

  describe('updateMyProfile', () => {
    it('should upsert the profile with provided data', async () => {
      const dto = { targetMajor: 'Engineering' };
      const result = await controller.updateMyProfile(
        mockUser as any,
        dto as any,
      );

      expect(profileService.upsert).toHaveBeenCalledWith('user-1', dto);
      expect(result).toEqual(mockProfile);
    });
  });

  describe('getProfile', () => {
    it('should return a profile with visibility check', async () => {
      const result = await controller.getProfile('profile-1', mockUser as any);

      expect(profileService.findByIdWithVisibilityCheck).toHaveBeenCalledWith(
        'profile-1',
        'user-1',
        'USER',
      );
      expect(result).toEqual(mockProfile);
    });
  });

  // ============================================
  // AI Analysis
  // ============================================

  describe('getAIAnalysis', () => {
    it('should return AI analysis for the user profile', async () => {
      const result = await controller.getAIAnalysis(mockUser as any);

      expect(profileService.findByUserId).toHaveBeenCalledWith('user-1');
      expect(aiService.analyzeProfileDetailed).toHaveBeenCalled();
      expect(result).toEqual({ overall: 'GREEN' });
    });

    it('should call analyzeProfileDetailed with empty object when no profile', async () => {
      (profileService.findByUserId as jest.Mock).mockResolvedValue(null);

      await controller.getAIAnalysis(mockUser as any);

      expect(aiService.analyzeProfileDetailed).toHaveBeenCalledWith({});
    });
  });

  // ============================================
  // Onboarding
  // ============================================

  describe('completeOnboarding', () => {
    it('should upsert profile and return success', async () => {
      const dto = { realName: 'Test User' };
      const result = await controller.completeOnboarding(
        mockUser as any,
        dto as any,
      );

      expect(profileService.upsert).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          realName: 'Test User',
          onboardingCompleted: true,
        }),
      );
      expect(result).toEqual({
        success: true,
        message: 'Onboarding completed',
      });
    });
  });

  // ============================================
  // Profile Grade
  // ============================================

  describe('getProfileGrade', () => {
    it('should return profile grade', async () => {
      const result = await controller.getProfileGrade(mockUser as any);

      expect(profileService.calculateProfileGrade).toHaveBeenCalledWith(
        'user-1',
      );
      expect(result).toEqual({ overall: 'B+', score: 85 });
    });
  });

  // ============================================
  // Test Scores
  // ============================================

  describe('getMyTestScores', () => {
    it('should return test scores for the user', async () => {
      const result = await controller.getMyTestScores(mockUser as any);

      expect(profileService.getTestScores).toHaveBeenCalledWith('user-1');
      expect(result).toEqual([mockTestScore]);
    });
  });

  describe('createTestScore', () => {
    it('should create a test score', async () => {
      const dto = { type: 'SAT', score: 1500 };
      const result = await controller.createTestScore(
        mockUser as any,
        dto as any,
      );

      expect(profileService.createTestScore).toHaveBeenCalledWith(
        'user-1',
        dto,
      );
      expect(result).toEqual(mockTestScore);
    });
  });

  describe('updateTestScore', () => {
    it('should update a test score', async () => {
      const dto = { score: 1550 };
      const result = await controller.updateTestScore(
        mockUser as any,
        'ts-1',
        dto as any,
      );

      expect(profileService.updateTestScore).toHaveBeenCalledWith(
        'user-1',
        'ts-1',
        dto,
      );
      expect(result).toEqual(mockTestScore);
    });
  });

  describe('deleteTestScore', () => {
    it('should delete a test score', async () => {
      await controller.deleteTestScore(mockUser as any, 'ts-1');

      expect(profileService.deleteTestScore).toHaveBeenCalledWith(
        'user-1',
        'ts-1',
      );
    });
  });

  // ============================================
  // Activities
  // ============================================

  describe('getMyActivities', () => {
    it('should return activities for the user', async () => {
      const result = await controller.getMyActivities(mockUser as any);

      expect(profileService.getActivities).toHaveBeenCalledWith('user-1');
      expect(result).toEqual([mockActivity]);
    });
  });

  describe('createActivity', () => {
    it('should create an activity', async () => {
      const dto = { name: 'Debate Club', category: 'ACADEMIC' };
      const result = await controller.createActivity(
        mockUser as any,
        dto as any,
      );

      expect(profileService.createActivity).toHaveBeenCalledWith('user-1', dto);
      expect(result).toEqual(mockActivity);
    });
  });

  describe('updateActivity', () => {
    it('should update an activity', async () => {
      const dto = { name: 'Updated Club' };
      const result = await controller.updateActivity(
        mockUser as any,
        'act-1',
        dto as any,
      );

      expect(profileService.updateActivity).toHaveBeenCalledWith(
        'user-1',
        'act-1',
        dto,
      );
      expect(result).toEqual(mockActivity);
    });
  });

  describe('deleteActivity', () => {
    it('should delete an activity', async () => {
      await controller.deleteActivity(mockUser as any, 'act-1');

      expect(profileService.deleteActivity).toHaveBeenCalledWith(
        'user-1',
        'act-1',
      );
    });
  });

  describe('reorderActivities', () => {
    it('should reorder activities and return success', async () => {
      const result = await controller.reorderActivities(mockUser as any, {
        ids: ['act-2', 'act-1'],
      });

      expect(profileService.reorderActivities).toHaveBeenCalledWith('user-1', [
        'act-2',
        'act-1',
      ]);
      expect(result).toEqual({ success: true });
    });
  });

  // ============================================
  // Awards
  // ============================================

  describe('getMyAwards', () => {
    it('should return awards for the user', async () => {
      const result = await controller.getMyAwards(mockUser as any);

      expect(profileService.getAwards).toHaveBeenCalledWith('user-1');
      expect(result).toEqual([mockAward]);
    });
  });

  describe('createAward', () => {
    it('should create an award', async () => {
      const dto = { name: 'Science Olympiad', level: 'NATIONAL' };
      const result = await controller.createAward(mockUser as any, dto as any);

      expect(profileService.createAward).toHaveBeenCalledWith('user-1', dto);
      expect(result).toEqual(mockAward);
    });
  });

  describe('updateAward', () => {
    it('should update an award', async () => {
      const dto = { level: 'INTERNATIONAL' };
      const result = await controller.updateAward(
        mockUser as any,
        'aw-1',
        dto as any,
      );

      expect(profileService.updateAward).toHaveBeenCalledWith(
        'user-1',
        'aw-1',
        dto,
      );
      expect(result).toEqual(mockAward);
    });
  });

  describe('deleteAward', () => {
    it('should delete an award', async () => {
      await controller.deleteAward(mockUser as any, 'aw-1');

      expect(profileService.deleteAward).toHaveBeenCalledWith('user-1', 'aw-1');
    });
  });

  describe('reorderAwards', () => {
    it('should reorder awards and return success', async () => {
      const result = await controller.reorderAwards(mockUser as any, {
        ids: ['aw-2', 'aw-1'],
      });

      expect(profileService.reorderAwards).toHaveBeenCalledWith('user-1', [
        'aw-2',
        'aw-1',
      ]);
      expect(result).toEqual({ success: true });
    });
  });

  // ============================================
  // Essays
  // ============================================

  describe('getMyEssays', () => {
    it('should return essays for the user', async () => {
      const result = await controller.getMyEssays(mockUser as any);

      expect(profileService.getEssays).toHaveBeenCalledWith('user-1');
      expect(result).toEqual([mockEssay]);
    });
  });

  describe('getEssay', () => {
    it('should return a single essay by id', async () => {
      const result = await controller.getEssay(mockUser as any, 'essay-1');

      expect(profileService.getEssayById).toHaveBeenCalledWith(
        'user-1',
        'essay-1',
      );
      expect(result).toEqual(mockEssay);
    });
  });

  describe('createEssay', () => {
    it('should create an essay', async () => {
      const dto = { title: 'My Story', content: 'Once upon a time...' };
      const result = await controller.createEssay(mockUser as any, dto as any);

      expect(profileService.createEssay).toHaveBeenCalledWith('user-1', dto);
      expect(result).toEqual(mockEssay);
    });
  });

  describe('updateEssay', () => {
    it('should update an essay', async () => {
      const dto = { title: 'Updated Title' };
      const result = await controller.updateEssay(
        mockUser as any,
        'essay-1',
        dto as any,
      );

      expect(profileService.updateEssay).toHaveBeenCalledWith(
        'user-1',
        'essay-1',
        dto,
      );
      expect(result).toEqual(mockEssay);
    });
  });

  describe('deleteEssay', () => {
    it('should delete an essay', async () => {
      await controller.deleteEssay(mockUser as any, 'essay-1');

      expect(profileService.deleteEssay).toHaveBeenCalledWith(
        'user-1',
        'essay-1',
      );
    });
  });

  // ============================================
  // Education
  // ============================================

  describe('getMyEducation', () => {
    it('should return education records for the user', async () => {
      const result = await controller.getMyEducation(mockUser as any);

      expect(profileService.getEducation).toHaveBeenCalledWith('user-1');
      expect(result).toEqual([mockEducation]);
    });
  });

  describe('createEducation', () => {
    it('should create an education record', async () => {
      const dto = { school: 'Test High School', degree: 'HIGH_SCHOOL' };
      const result = await controller.createEducation(
        mockUser as any,
        dto as any,
      );

      expect(profileService.createEducation).toHaveBeenCalledWith(
        'user-1',
        dto,
      );
      expect(result).toEqual(mockEducation);
    });
  });

  describe('updateEducation', () => {
    it('should update an education record', async () => {
      const dto = { school: 'Updated School' };
      const result = await controller.updateEducation(
        mockUser as any,
        'edu-1',
        dto as any,
      );

      expect(profileService.updateEducation).toHaveBeenCalledWith(
        'user-1',
        'edu-1',
        dto,
      );
      expect(result).toEqual(mockEducation);
    });
  });

  describe('deleteEducation', () => {
    it('should delete an education record', async () => {
      await controller.deleteEducation(mockUser as any, 'edu-1');

      expect(profileService.deleteEducation).toHaveBeenCalledWith(
        'user-1',
        'edu-1',
      );
    });
  });

  // ============================================
  // Target Schools
  // ============================================

  describe('getMyTargetSchools', () => {
    it('should return target schools via SchoolListService', async () => {
      const result = await controller.getMyTargetSchools(mockUser as any);

      expect(schoolListService.getUserSchoolList).toHaveBeenCalledWith(
        'user-1',
      );
      expect(result).toEqual([]);
    });
  });

  describe('setTargetSchools', () => {
    it('should clear existing and add new target schools', async () => {
      (schoolListService.getUserSchoolList as jest.Mock).mockResolvedValue([
        { id: 'sl-old', schoolId: 'old-school' },
      ]);

      const data = { schoolIds: ['school-1'], priorities: { 'school-1': 1 } };
      const result = await controller.setTargetSchools(mockUser as any, data);

      expect(schoolListService.removeItem).toHaveBeenCalledWith(
        'user-1',
        'sl-old',
      );
      expect(schoolListService.addSchool).toHaveBeenCalledWith('user-1', {
        schoolId: 'school-1',
        tier: 'REACH',
      });
      expect(result).toHaveLength(1);
    });
  });

  describe('addTargetSchool', () => {
    it('should add a target school with default priority', async () => {
      const result = await controller.addTargetSchool(
        mockUser as any,
        'school-1',
        undefined,
      );

      expect(schoolListService.addSchool).toHaveBeenCalledWith('user-1', {
        schoolId: 'school-1',
        tier: 'TARGET',
      });
    });
  });

  describe('removeTargetSchool', () => {
    it('should find and remove the target school by schoolId', async () => {
      (schoolListService.getUserSchoolList as jest.Mock).mockResolvedValue([
        { id: 'sl-1', schoolId: 'school-1' },
      ]);

      await controller.removeTargetSchool(mockUser as any, 'school-1');

      expect(schoolListService.removeItem).toHaveBeenCalledWith(
        'user-1',
        'sl-1',
      );
    });

    it('should do nothing if schoolId is not found', async () => {
      (schoolListService.getUserSchoolList as jest.Mock).mockResolvedValue([]);

      await controller.removeTargetSchool(mockUser as any, 'nonexistent');

      expect(schoolListService.removeItem).not.toHaveBeenCalled();
    });
  });
});
