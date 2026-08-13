import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../prisma/prisma.service';
import { ResumeService } from '../../resume/resume.service';
import { ResumeToolsService } from './resume-tools.service';

describe('ResumeToolsService', () => {
  let service: ResumeToolsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResumeToolsService,
        {
          provide: PrismaService,
          useValue: {
            resume: {
              findMany: jest.fn().mockResolvedValue([]),
              findUnique: jest.fn(),
            },
          },
        },
        {
          provide: ResumeService,
          useValue: {
            findByUser: jest.fn().mockResolvedValue([]),
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(ResumeToolsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should register tool handlers', () => {
    const handlers = service.getHandlers();
    expect(handlers.has('get_resume_list')).toBe(true);
    expect(handlers.has('get_resume_details')).toBe(true);
    expect(handlers.has('review_resume')).toBe(true);
    expect(handlers.has('optimize_resume_bullets')).toBe(true);
    expect(handlers.has('suggest_resume_content')).toBe(true);
  });
});
