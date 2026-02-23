import { Test, TestingModule } from '@nestjs/testing';
import { EssayAiController } from './essay-ai.controller';
import { EssayAiService } from './essay-ai.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

describe('EssayAiController', () => {
  let controller: EssayAiController;
  let service: EssayAiService;

  const mockUser = {
    id: 'user-1',
    email: 'test@test.com',
    role: 'USER',
    locale: 'zh',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EssayAiController],
      providers: [
        {
          provide: EssayAiService,
          useValue: {
            polishEssay: jest.fn().mockResolvedValue({ polished: 'text' }),
            reviewEssay: jest.fn().mockResolvedValue({ review: 'feedback' }),
            brainstormIdeas: jest.fn().mockResolvedValue({ ideas: [] }),
            getEssayAIHistory: jest.fn().mockResolvedValue([]),
            getGalleryEssays: jest
              .fn()
              .mockResolvedValue({ items: [], total: 0 }),
            getGalleryEssayDetail: jest
              .fn()
              .mockResolvedValue({ id: 'essay-1' }),
            analyzeGalleryEssay: jest
              .fn()
              .mockResolvedValue({ analysis: 'done' }),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<EssayAiController>(EssayAiController);
    service = module.get<EssayAiService>(EssayAiService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('polishEssay', () => {
    it('should delegate to essayAiService.polishEssay', async () => {
      const dto = { content: 'raw essay', style: 'formal' } as any;
      const result = await controller.polishEssay(mockUser as any, dto);

      expect(service.polishEssay).toHaveBeenCalledWith('user-1', dto, 'zh');
      expect(result).toEqual({ polished: 'text' });
    });
  });

  describe('reviewEssay', () => {
    it('should delegate to essayAiService.reviewEssay', async () => {
      const dto = { content: 'my essay', prompt: 'Common App #1' } as any;
      const result = await controller.reviewEssay(mockUser as any, dto);

      expect(service.reviewEssay).toHaveBeenCalledWith('user-1', dto, 'zh');
      expect(result).toEqual({ review: 'feedback' });
    });
  });

  describe('brainstormIdeas', () => {
    it('should delegate to essayAiService.brainstormIdeas', async () => {
      const dto = { topic: 'leadership' } as any;
      const result = await controller.brainstormIdeas(mockUser as any, dto);

      expect(service.brainstormIdeas).toHaveBeenCalledWith('user-1', dto, 'zh');
      expect(result).toEqual({ ideas: [] });
    });
  });

  describe('getHistory', () => {
    it('should delegate to essayAiService.getEssayAIHistory', async () => {
      const result = await controller.getHistory(mockUser as any, 'essay-1');

      expect(service.getEssayAIHistory).toHaveBeenCalledWith(
        'user-1',
        'essay-1',
      );
      expect(result).toEqual([]);
    });
  });

  describe('getGalleryEssays', () => {
    it('should pass parsed query params to service', async () => {
      const result = await controller.getGalleryEssays(
        'MIT',
        'COMMON_APP',
        '1',
        '2025',
        'ADMITTED',
        '1',
        '20',
        'true',
        'newest',
        '2',
        '10',
      );

      expect(service.getGalleryEssays).toHaveBeenCalledWith({
        school: 'MIT',
        type: 'COMMON_APP',
        promptNumber: 1,
        year: 2025,
        result: 'ADMITTED',
        rankMin: 1,
        rankMax: 20,
        isVerified: true,
        sortBy: 'newest',
        page: 2,
        pageSize: 10,
      });
      expect(result).toEqual({ items: [], total: 0 });
    });

    it('should use defaults when query params are omitted', async () => {
      await controller.getGalleryEssays();

      expect(service.getGalleryEssays).toHaveBeenCalledWith({
        school: undefined,
        type: undefined,
        promptNumber: undefined,
        year: undefined,
        result: undefined,
        rankMin: undefined,
        rankMax: undefined,
        isVerified: false,
        sortBy: undefined,
        page: 1,
        pageSize: 12,
      });
    });
  });

  describe('getGalleryEssayDetail', () => {
    it('should delegate to essayAiService.getGalleryEssayDetail', async () => {
      const result = await controller.getGalleryEssayDetail('essay-1');

      expect(service.getGalleryEssayDetail).toHaveBeenCalledWith('essay-1');
      expect(result).toEqual({ id: 'essay-1' });
    });
  });

  describe('analyzeGalleryEssay', () => {
    it('should delegate to essayAiService.analyzeGalleryEssay', async () => {
      const result = await controller.analyzeGalleryEssay(
        mockUser as any,
        'essay-1',
        { schoolName: 'Stanford' },
      );

      expect(service.analyzeGalleryEssay).toHaveBeenCalledWith(
        'user-1',
        'essay-1',
        'Stanford',
        'zh',
      );
      expect(result).toEqual({ analysis: 'done' });
    });
  });
});
