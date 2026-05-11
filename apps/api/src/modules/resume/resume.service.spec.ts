import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ResumeService } from './resume.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthorizationService } from '../../common/services/authorization.service';
import { ProfileService } from '../profile/profile.service';
import { ResumeAiService } from '../ai/resume-ai.service';

describe('ResumeService', () => {
  let service: ResumeService;

  const mockPrisma = {
    resume: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    resumeSection: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      createMany: jest.fn(),
      aggregate: jest.fn(),
    },
    resumeSnapshot: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    resumeAIReview: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockAuth = {
    verifyOwnership: jest.fn(),
  };

  const mockProfileService = {
    findByUserId: jest.fn(),
  };

  const mockResumeAiService = {
    reviewResume: jest.fn(),
    optimizeResumeBullets: jest.fn(),
    suggestSectionContent: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResumeService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuthorizationService, useValue: mockAuth },
        { provide: ProfileService, useValue: mockProfileService },
        { provide: ResumeAiService, useValue: mockResumeAiService },
      ],
    }).compile();

    service = module.get<ResumeService>(ResumeService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all resumes for user', async () => {
      const mockResumes = [
        { id: 'r1', title: 'Resume 1', type: 'COLLEGE_APPLICATION' },
        { id: 'r2', title: 'Resume 2', type: 'INTERNSHIP' },
      ];
      mockPrisma.resume.findMany.mockResolvedValue(mockResumes);

      const result = await service.findAll('user-1');

      expect(result).toHaveLength(2);
      expect(mockPrisma.resume.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { updatedAt: 'desc' },
        select: expect.objectContaining({
          id: true,
          title: true,
          type: true,
        }),
      });
    });
  });

  describe('findById', () => {
    it('should return resume with sections', async () => {
      const mockResume = {
        id: 'r1',
        userId: 'user-1',
        title: 'My Resume',
        sections: [{ id: 's1', type: 'HEADER', order: 0 }],
      };
      mockPrisma.resume.findUnique.mockResolvedValue(mockResume);
      mockAuth.verifyOwnership.mockReturnValue(mockResume);

      const result = await service.findById('user-1', 'r1');

      expect(result.id).toBe('r1');
      expect(result.sections).toHaveLength(1);
    });

    it('should throw when resume not owned by user', async () => {
      mockPrisma.resume.findUnique.mockResolvedValue(null);
      mockAuth.verifyOwnership.mockImplementation(() => {
        throw new NotFoundException('Resume not found');
      });

      await expect(service.findById('user-1', 'r1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('should create resume with default sections', async () => {
      const mockCreated = {
        id: 'r1',
        userId: 'user-1',
        title: 'New Resume',
        type: 'COLLEGE_APPLICATION',
        sections: [
          { id: 's1', type: 'HEADER', order: 0 },
          { id: 's2', type: 'EDUCATION', order: 1 },
        ],
      };
      mockPrisma.resume.create.mockResolvedValue(mockCreated);

      const result = await service.create('user-1', {
        title: 'New Resume',
      });

      expect(result.id).toBe('r1');
      expect(mockPrisma.resume.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            title: 'New Resume',
            type: 'COLLEGE_APPLICATION',
          }),
        }),
      );
    });

    it('should create with specified type', async () => {
      const mockCreated = {
        id: 'r2',
        userId: 'user-1',
        title: 'Internship Resume',
        type: 'INTERNSHIP',
        sections: [],
      };
      mockPrisma.resume.create.mockResolvedValue(mockCreated);

      const result = await service.create('user-1', {
        title: 'Internship Resume',
        type: 'INTERNSHIP',
      });

      expect(result.type).toBe('INTERNSHIP');
    });

    it('should persist target context on create', async () => {
      const targetContext = {
        targetRole: 'Data Analyst Intern',
        company: 'Fintech',
        jobDescription: 'SQL and dashboarding role',
      };
      const mockCreated = {
        id: 'r3',
        userId: 'user-1',
        title: 'Targeted Resume',
        type: 'INTERNSHIP',
        targetContext,
        sections: [],
      };
      mockPrisma.resume.create.mockResolvedValue(mockCreated);

      const result = await service.create('user-1', {
        title: 'Targeted Resume',
        type: 'INTERNSHIP',
        targetContext,
      });

      expect(result.targetContext).toEqual(targetContext);
      expect(mockPrisma.resume.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            targetContext,
          }),
        }),
      );
    });
  });

  describe('update', () => {
    it('should update resume fields', async () => {
      const existingResume = { id: 'r1', userId: 'user-1' };
      mockPrisma.resume.findUnique.mockResolvedValue(existingResume);
      mockAuth.verifyOwnership.mockReturnValue(existingResume);
      mockPrisma.resume.update.mockResolvedValue({
        id: 'r1',
        title: 'Updated Title',
      });

      const result = await service.update('user-1', 'r1', {
        title: 'Updated Title',
        targetContext: { targetSchool: 'MIT', targetMajor: 'CS' },
      });

      expect(result.title).toBe('Updated Title');
      expect(mockPrisma.resume.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            targetContext: { targetSchool: 'MIT', targetMajor: 'CS' },
          }),
        }),
      );
    });
  });

  describe('delete', () => {
    it('should delete resume', async () => {
      const existingResume = { id: 'r1', userId: 'user-1' };
      mockPrisma.resume.findUnique.mockResolvedValue(existingResume);
      mockAuth.verifyOwnership.mockReturnValue(existingResume);
      mockPrisma.resume.delete.mockResolvedValue({});

      await service.delete('user-1', 'r1');

      expect(mockPrisma.resume.delete).toHaveBeenCalledWith({
        where: { id: 'r1' },
      });
    });
  });

  describe('duplicate', () => {
    it('should create a copy of the resume', async () => {
      const original = {
        id: 'r1',
        userId: 'user-1',
        title: 'Original',
        type: 'COLLEGE_APPLICATION',
        templateId: 'jake-classic',
        language: 'en',
        settings: {},
        sections: [
          {
            type: 'HEADER',
            title: 'Header',
            content: { name: 'John' },
            isVisible: true,
            order: 0,
          },
        ],
      };
      mockPrisma.resume.findUnique.mockResolvedValue(original);
      mockAuth.verifyOwnership.mockReturnValue(original);

      const duplicated = { ...original, id: 'r2', title: 'Original (Copy)' };
      mockPrisma.resume.create.mockResolvedValue(duplicated);

      const result = await service.duplicate('user-1', 'r1');

      expect(result.id).toBe('r2');
      expect(result.title).toBe('Original (Copy)');
      expect(mockPrisma.resume.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Original (Copy)',
          }),
        }),
      );
    });
  });

  describe('addSection', () => {
    it('should add a new section to resume', async () => {
      const resume = { id: 'r1', userId: 'user-1' };
      mockPrisma.resume.findUnique.mockResolvedValue(resume);
      mockAuth.verifyOwnership.mockReturnValue(resume);
      mockPrisma.resumeSection.aggregate.mockResolvedValue({
        _max: { order: 2 },
      });
      mockPrisma.resumeSection.create.mockResolvedValue({
        id: 's-new',
        type: 'SKILLS',
        title: 'Skills',
        order: 3,
      });

      const result = await service.addSection('user-1', 'r1', {
        type: 'SKILLS',
        title: 'Skills',
      });

      expect(result.type).toBe('SKILLS');
      expect(result.order).toBe(3);
    });
  });

  describe('updateSection', () => {
    it('should update section content', async () => {
      mockPrisma.resumeSection.findUnique.mockResolvedValue({
        id: 's1',
        resumeId: 'r1',
        resume: { userId: 'user-1' },
      });
      mockPrisma.resumeSection.update.mockResolvedValue({
        id: 's1',
        title: 'Updated Skills',
      });

      const result = await service.updateSection('user-1', 'r1', 's1', {
        title: 'Updated Skills',
      });

      expect(result.title).toBe('Updated Skills');
    });

    it('should throw NotFoundException when section not found', async () => {
      mockPrisma.resumeSection.findUnique.mockResolvedValue(null);

      await expect(
        service.updateSection('user-1', 'r1', 'nonexistent', { title: 'test' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when section does not belong to resume', async () => {
      mockPrisma.resumeSection.findUnique.mockResolvedValue({
        id: 's1',
        resumeId: 'r-other',
        resume: { userId: 'user-1' },
      });

      await expect(
        service.updateSection('user-1', 'r1', 's1', { title: 'test' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteSection', () => {
    it('should delete a section', async () => {
      mockPrisma.resumeSection.findUnique.mockResolvedValue({
        id: 's1',
        resumeId: 'r1',
        resume: { userId: 'user-1' },
      });
      mockPrisma.resumeSection.delete.mockResolvedValue({});

      await service.deleteSection('user-1', 'r1', 's1');

      expect(mockPrisma.resumeSection.delete).toHaveBeenCalledWith({
        where: { id: 's1' },
      });
    });
  });

  describe('reorderSections', () => {
    it('should reorder sections', async () => {
      const resume = { id: 'r1', userId: 'user-1' };
      mockPrisma.resume.findUnique.mockResolvedValue(resume);
      mockAuth.verifyOwnership.mockReturnValue(resume);
      mockPrisma.resumeSection.findMany.mockResolvedValue([
        { id: 's1' },
        { id: 's2' },
      ]);
      mockPrisma.$transaction.mockResolvedValue([]);

      await service.reorderSections('user-1', 'r1', {
        sectionIds: ['s2', 's1'],
      });

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should throw ForbiddenException for invalid section ids', async () => {
      const resume = { id: 'r1', userId: 'user-1' };
      mockPrisma.resume.findUnique.mockResolvedValue(resume);
      mockAuth.verifyOwnership.mockReturnValue(resume);
      mockPrisma.resumeSection.findMany.mockResolvedValue([{ id: 's1' }]);

      await expect(
        service.reorderSections('user-1', 'r1', {
          sectionIds: ['s1', 's-invalid'],
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('aiReview', () => {
    it('should review resume and store result', async () => {
      const mockResume = {
        id: 'r1',
        userId: 'user-1',
        templateId: 'jake-classic',
        type: 'COLLEGE_APPLICATION',
        targetContext: { targetSchool: 'Stanford', keywords: ['robotics'] },
        sections: [
          {
            id: 's1',
            type: 'EDUCATION',
            title: 'Education',
            content: { items: [] },
            isVisible: true,
          },
        ],
      };
      mockPrisma.resume.findUnique.mockResolvedValue(mockResume);
      mockAuth.verifyOwnership.mockReturnValue(mockResume);

      const reviewResult = {
        overallScore: 72,
        dimensions: [],
        sectionFeedback: [],
        contentGaps: [],
        bulletQuality: {
          actionVerbUsage: 0,
          quantificationRate: 0,
          averageLength: 0,
        },
        summary: 'Needs improvement',
        version: 2,
      };
      mockResumeAiService.reviewResume.mockResolvedValue(reviewResult);
      mockPrisma.resumeAIReview.create.mockResolvedValue({
        id: 'review-1',
        output: reviewResult,
        overallScore: 72,
        createdAt: new Date(),
      });

      const result = await service.aiReview('user-1', 'r1', 'MIT', 'CS', {
        applicationRound: 'RD',
      });

      expect(result.overallScore).toBe(72);
      expect(mockResumeAiService.reviewResume).toHaveBeenCalledWith(
        expect.objectContaining({
          resumeType: 'COLLEGE_APPLICATION',
          targetContext: expect.objectContaining({
            targetSchool: 'MIT',
            targetMajor: 'CS',
            applicationRound: 'RD',
            keywords: ['robotics'],
          }),
        }),
        expect.objectContaining({
          targetSchool: 'MIT',
          targetMajor: 'CS',
          applicationRound: 'RD',
          keywords: ['robotics'],
        }),
      );
    });
  });

  describe('createSnapshot', () => {
    it('should create a snapshot of current resume state', async () => {
      const mockResume = {
        id: 'r1',
        userId: 'user-1',
        title: 'My Resume',
        type: 'COLLEGE_APPLICATION',
        templateId: 'jake-classic',
        language: 'en',
        version: 3,
        settings: {},
        sections: [
          {
            type: 'HEADER',
            title: 'Header',
            content: {},
            isVisible: true,
            order: 0,
          },
        ],
      };
      mockPrisma.resume.findUnique.mockResolvedValue(mockResume);
      mockAuth.verifyOwnership.mockReturnValue(mockResume);
      mockPrisma.resumeSnapshot.create.mockResolvedValue({
        id: 'snap-1',
        version: 3,
        description: 'Before major edit',
      });

      const result = await service.createSnapshot(
        'user-1',
        'r1',
        'Before major edit',
      );

      expect(result.id).toBe('snap-1');
      expect(mockPrisma.resumeSnapshot.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            resumeId: 'r1',
            version: 3,
            description: 'Before major edit',
          }),
        }),
      );
    });
  });
});
