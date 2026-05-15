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
    resumeAIIssue: {
      createMany: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    resumeEvidence: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
      delete: jest.fn(),
    },
    resumeTarget: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    resumeExport: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    resumeComment: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
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
    mockPrisma.$transaction.mockImplementation(async (arg: any) =>
      Array.isArray(arg) ? Promise.all(arg) : arg(mockPrisma),
    );
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

  describe('resume 2.0 foundations', () => {
    it('should list reusable evidence for the current user', async () => {
      mockPrisma.resumeEvidence.findMany.mockResolvedValue([
        { id: 'ev-1', userId: 'user-1', title: 'Research paper' },
      ]);

      const result = await service.listEvidence('user-1');

      expect(result).toHaveLength(1);
      expect(mockPrisma.resumeEvidence.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { updatedAt: 'desc' },
      });
    });

    it('should create a structured target', async () => {
      mockPrisma.resumeTarget.create.mockResolvedValue({
        id: 'target-1',
        title: 'Data Analyst',
      });

      const result = await service.createTarget('user-1', {
        type: 'FULL_TIME_JOB',
        title: 'Data Analyst',
        company: 'Fintech Co',
        role: 'Analyst',
        keywords: ['SQL', 'dashboarding'],
      });

      expect(result.id).toBe('target-1');
      expect(mockPrisma.resumeTarget.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            type: 'FULL_TIME_JOB',
            company: 'Fintech Co',
            role: 'Analyst',
            keywords: ['SQL', 'dashboarding'],
          }),
        }),
      );
    });

    it('should create a tailored resume variant from visible base sections', async () => {
      const base = {
        id: 'base-1',
        userId: 'user-1',
        title: 'Master Resume',
        type: 'INTERNSHIP',
        templateId: 'ats-safe',
        language: 'en',
        settings: {},
        targetContext: { targetRole: 'Analyst Intern' },
        sections: [
          {
            id: 's1',
            type: 'HEADER',
            title: 'Header',
            content: { name: 'Jane' },
            isVisible: true,
            order: 0,
          },
          {
            id: 's2',
            type: 'CUSTOM',
            title: 'Hidden',
            content: {},
            isVisible: false,
            order: 1,
          },
        ],
      };
      const target = {
        id: 'target-1',
        title: 'Full-time Analyst',
        company: 'Fintech Co',
        role: 'Data Analyst',
        jobDescription: 'SQL dashboards',
        keywords: ['SQL'],
      };
      const tailored = { ...base, id: 'tailored-1', type: 'FULL_TIME_JOB' };
      mockPrisma.resume.findUnique.mockResolvedValue(base);
      mockAuth.verifyOwnership.mockReturnValue(base);
      mockPrisma.resumeTarget.findFirst.mockResolvedValue(target);
      mockPrisma.resume.create.mockResolvedValue(tailored);

      const result = await service.tailorResume('user-1', 'base-1', {
        targetId: 'target-1',
        type: 'FULL_TIME_JOB',
      });

      expect(result.id).toBe('tailored-1');
      expect(mockPrisma.resume.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            baseResumeId: 'base-1',
            targetId: 'target-1',
            variantKind: 'TAILORED',
            family: 'CAREER',
            type: 'FULL_TIME_JOB',
            targetContext: expect.objectContaining({
              targetRole: 'Data Analyst',
              company: 'Fintech Co',
              jobDescription: 'SQL dashboards',
              keywords: ['SQL'],
            }),
            sections: expect.objectContaining({
              create: expect.arrayContaining([
                expect.objectContaining({ type: 'HEADER', isVisible: true }),
              ]),
            }),
          }),
        }),
      );
    });

    it('should preview an uploaded text resume into sections and evidence', async () => {
      const resume = {
        id: 'r1',
        userId: 'user-1',
        title: 'Master Resume',
        version: 1,
        type: 'FULL_TIME_JOB',
        templateId: 'ats-safe',
        language: 'en',
        settings: {},
        targetContext: {},
        sections: [
          {
            id: 'header-1',
            type: 'HEADER',
            title: 'Contact',
            content: {},
            isVisible: true,
            order: 0,
          },
          {
            id: 'work-1',
            type: 'WORK_EXPERIENCE',
            title: 'Work Experience',
            content: { items: [] },
            isVisible: true,
            order: 1,
          },
        ],
      };
      mockPrisma.resume.findUnique.mockResolvedValue(resume);
      mockAuth.verifyOwnership.mockReturnValue(resume);

      const file = {
        originalname: 'resume.txt',
        mimetype: 'text/plain',
        size: 240,
        buffer: Buffer.from(
          [
            'Jane Doe',
            'jane@example.com | +1 555 0100',
            'WORK EXPERIENCE',
            'Data Analyst Intern',
            '- Built SQL dashboards used by 30 operators',
            'SKILLS',
            'SQL, Python, Tableau',
          ].join('\n'),
        ),
      } as Express.Multer.File;

      const preview = await service.previewResumeUploadImport(
        'user-1',
        'r1',
        file,
      );

      expect(preview.sourceFileName).toBe('resume.txt');
      expect(preview.sections).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            sectionId: 'header-1',
            sectionType: 'HEADER',
            changeType: 'replace',
          }),
          expect.objectContaining({
            sectionId: 'work-1',
            sectionType: 'WORK_EXPERIENCE',
            changeType: 'replace',
          }),
          expect.objectContaining({
            sectionType: 'SKILLS',
            changeType: 'create',
          }),
        ]),
      );
      expect(preview.evidence).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: 'WORK_EXPERIENCE',
            title: 'Data Analyst Intern',
          }),
          expect.objectContaining({
            kind: 'SKILL',
            title: 'Imported skills',
          }),
        ]),
      );
    });

    it('should apply selected uploaded sections and evidence with a snapshot', async () => {
      const resume = {
        id: 'r1',
        userId: 'user-1',
        title: 'Master Resume',
        version: 2,
        type: 'FULL_TIME_JOB',
        templateId: 'ats-safe',
        language: 'en',
        settings: {},
        targetContext: {},
        sections: [
          {
            id: 'header-1',
            type: 'HEADER',
            title: 'Contact',
            content: {},
            isVisible: true,
            order: 0,
          },
        ],
      };
      mockPrisma.resume.findUnique.mockResolvedValue(resume);
      mockAuth.verifyOwnership.mockReturnValue(resume);
      mockPrisma.resumeSnapshot.create.mockResolvedValue({ id: 'snap-1' });
      mockPrisma.resumeSection.aggregate.mockResolvedValue({
        _max: { order: 0 },
      });
      mockPrisma.resumeSection.update.mockResolvedValue({});
      mockPrisma.resumeSection.create.mockResolvedValue({});
      mockPrisma.resumeEvidence.createMany.mockResolvedValue({ count: 1 });
      mockPrisma.resume.update.mockResolvedValue({});

      await service.applyResumeUploadImport('user-1', 'r1', {
        sections: [
          {
            sectionId: 'header-1',
            sectionType: 'HEADER',
            title: 'Contact',
            content: { name: 'Jane Doe', email: 'jane@example.com' },
          },
          {
            sectionType: 'SKILLS',
            title: 'Skills',
            content: { categories: [{ name: 'Skills', items: ['SQL'] }] },
          },
        ],
        evidence: [
          {
            kind: 'SKILL',
            title: 'Imported skills',
            skills: ['SQL'],
            tags: ['resume-import'],
            content: { categories: [] },
          },
        ],
      });

      expect(mockPrisma.resumeSnapshot.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            description: 'Before uploaded resume import',
          }),
        }),
      );
      expect(mockPrisma.resumeSection.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'header-1' },
          data: expect.objectContaining({ title: 'Contact' }),
        }),
      );
      expect(mockPrisma.resumeSection.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            resumeId: 'r1',
            type: 'SKILLS',
            order: 1,
          }),
        }),
      );
      expect(mockPrisma.resumeEvidence.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: [
            expect.objectContaining({
              userId: 'user-1',
              kind: 'SKILL',
              source: 'RESUME_IMPORT',
            }),
          ],
        }),
      );
    });

    it('should manage collaboration comments for a resume', async () => {
      const resume = {
        id: 'r1',
        userId: 'user-1',
        sections: [{ id: 's1' }],
      };
      const comment = {
        id: 'comment-1',
        resumeId: 'r1',
        sectionId: 's1',
        authorId: 'user-1',
        role: 'STUDENT',
        body: 'Please review this bullet',
        status: 'OPEN',
      };
      mockPrisma.resume.findUnique.mockResolvedValue(resume);
      mockAuth.verifyOwnership.mockReturnValue(resume);
      mockPrisma.resumeComment.findMany.mockResolvedValue([comment]);
      mockPrisma.resumeComment.create.mockResolvedValue(comment);
      mockPrisma.resumeComment.findUnique.mockResolvedValue(comment);
      mockPrisma.resumeComment.update.mockResolvedValue({
        ...comment,
        status: 'RESOLVED',
      });

      await expect(service.listComments('user-1', 'r1')).resolves.toHaveLength(
        1,
      );
      await expect(
        service.createComment('user-1', 'r1', {
          sectionId: 's1',
          body: 'Please review this bullet',
        }),
      ).resolves.toEqual(comment);
      await expect(
        service.updateComment('user-1', 'r1', 'comment-1', {
          status: 'RESOLVED',
        }),
      ).resolves.toEqual(expect.objectContaining({ status: 'RESOLVED' }));

      expect(mockPrisma.resumeComment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            resumeId: 'r1',
            sectionId: 's1',
            authorId: 'user-1',
            body: 'Please review this bullet',
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
