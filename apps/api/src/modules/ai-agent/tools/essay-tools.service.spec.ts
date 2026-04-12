import { Test, TestingModule } from '@nestjs/testing';
import { EssayToolsService } from './essay-tools.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { LLMService } from '../core/llm.service';
import { EssayAiService } from '../../essay/essay-ai.service';

describe('EssayToolsService', () => {
  let service: EssayToolsService;
  let prisma: { essay: { findMany: jest.Mock } };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EssayToolsService,
        {
          provide: PrismaService,
          useValue: {
            profile: { findUnique: jest.fn().mockResolvedValue(null) },
            essay: { findMany: jest.fn().mockResolvedValue([]) },
            essayPrompt: { findMany: jest.fn().mockResolvedValue([]) },
          },
        },
        {
          provide: LLMService,
          useValue: {
            chatSimple: jest.fn().mockResolvedValue('{"outline":[]}'),
          },
        },
        {
          provide: EssayAiService,
          useValue: {
            polish: jest.fn().mockResolvedValue({ result: 'polished' }),
            review: jest.fn().mockResolvedValue({ result: 'reviewed' }),
            brainstorm: jest.fn().mockResolvedValue({ ideas: [] }),
          },
        },
      ],
    }).compile();

    service = module.get(EssayToolsService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should register tool handlers', () => {
    const handlers = service.getHandlers();
    expect(handlers.has('get_essays')).toBe(true);
    expect(handlers.has('review_essay')).toBe(true);
    expect(handlers.has('polish_essay')).toBe(true);
    expect(handlers.has('generate_outline')).toBe(true);
    expect(handlers.has('brainstorm_ideas')).toBe(true);
    expect(handlers.has('search_essay_prompts')).toBe(true);
  });

  it('should return no-essay message when profile has no essays', async () => {
    (prisma as any).profile.findUnique.mockResolvedValue(null);
    const result = await service.getEssays('user-1', 'en');
    expect(result).toHaveProperty('message');
  });

  it('should return essays when profile has them', async () => {
    (prisma as any).profile.findUnique.mockResolvedValue({
      essays: [
        {
          id: 'e1',
          title: 'Why MIT',
          prompt: 'Describe...',
          content: 'My passion for technology',
          updatedAt: new Date(),
        },
      ],
    });
    const result = await service.getEssays('user-1', 'en');
    expect(result).toHaveProperty('count', 1);
    expect(result).toHaveProperty('essays');
  });
});
