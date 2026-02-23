import { Test, TestingModule } from '@nestjs/testing';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';

describe('AiController', () => {
  let controller: AiController;
  let service: AiService;

  const mockUser = {
    id: 'user-1',
    email: 'test@test.com',
    role: 'USER',
    locale: 'zh',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AiController],
      providers: [
        {
          provide: AiService,
          useValue: {
            analyzeProfile: jest
              .fn()
              .mockResolvedValue({ strengths: [], weaknesses: [] }),
            reviewEssay: jest
              .fn()
              .mockResolvedValue({ score: 85, feedback: 'Good' }),
            generateEssayIdeas: jest.fn().mockResolvedValue(['idea1', 'idea2']),
            schoolMatch: jest
              .fn()
              .mockResolvedValue([{ name: 'MIT', match: 0.9 }]),
            chat: jest.fn().mockResolvedValue('AI response'),
            polishEssay: jest
              .fn()
              .mockResolvedValue({ polished: 'better text' }),
            rewriteParagraph: jest
              .fn()
              .mockResolvedValue({ rewritten: 'new paragraph' }),
            continueWriting: jest
              .fn()
              .mockResolvedValue({ continuation: 'more text' }),
            generateOpening: jest
              .fn()
              .mockResolvedValue({ opening: 'It was a dark...' }),
            generateEnding: jest
              .fn()
              .mockResolvedValue({ ending: 'In conclusion...' }),
          },
        },
      ],
    }).compile();

    controller = module.get<AiController>(AiController);
    service = module.get<AiService>(AiService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('analyzeProfile', () => {
    it('should delegate to aiService.analyzeProfile', async () => {
      const data = { gpa: 3.9, targetMajor: 'CS' } as any;
      const result = await controller.analyzeProfile(mockUser as any, data);

      expect(service.analyzeProfile).toHaveBeenCalledWith(data, 'zh');
      expect(result).toEqual({ strengths: [], weaknesses: [] });
    });
  });

  describe('reviewEssay', () => {
    it('should delegate to aiService.reviewEssay', async () => {
      const data = { prompt: 'Why us?', content: 'My essay content' } as any;
      const result = await controller.reviewEssay(mockUser as any, data);

      expect(service.reviewEssay).toHaveBeenCalledWith(data, 'zh');
      expect(result).toEqual({ score: 85, feedback: 'Good' });
    });
  });

  describe('generateIdeas', () => {
    it('should delegate to aiService.generateEssayIdeas and wrap result', async () => {
      const data = { topic: 'leadership', background: 'club president' } as any;
      const result = await controller.generateIdeas(mockUser as any, data);

      expect(service.generateEssayIdeas).toHaveBeenCalledWith(
        'leadership',
        'club president',
        'zh',
      );
      expect(result).toEqual({ ideas: ['idea1', 'idea2'] });
    });
  });

  describe('schoolMatch', () => {
    it('should delegate to aiService.schoolMatch and wrap result', async () => {
      const data = { gpa: 3.9, targetMajor: 'CS' } as any;
      const result = await controller.schoolMatch(mockUser as any, data);

      expect(service.schoolMatch).toHaveBeenCalledWith(data, 'zh');
      expect(result).toEqual({ schools: [{ name: 'MIT', match: 0.9 }] });
    });
  });

  describe('chat', () => {
    it('should prepend system message and delegate to aiService.chat', async () => {
      const data = {
        messages: [{ role: 'user', content: 'Hello' }],
      } as any;
      const result = await controller.chat(mockUser as any, data);

      expect(service.chat).toHaveBeenCalledWith([
        {
          role: 'system',
          content: expect.stringContaining('留学申请顾问'),
        },
        { role: 'user', content: 'Hello' },
      ]);
      expect(result).toEqual({ response: 'AI response' });
    });
  });

  describe('polishEssay', () => {
    it('should delegate to aiService.polishEssay', async () => {
      const data = { content: 'raw text', style: 'formal' } as any;
      const result = await controller.polishEssay(mockUser as any, data);

      expect(service.polishEssay).toHaveBeenCalledWith(
        'raw text',
        'formal',
        'zh',
      );
      expect(result).toEqual({ polished: 'better text' });
    });
  });

  describe('rewriteParagraph', () => {
    it('should delegate to aiService.rewriteParagraph', async () => {
      const data = {
        paragraph: 'old paragraph',
        instruction: 'make it vivid',
      } as any;
      const result = await controller.rewriteParagraph(mockUser as any, data);

      expect(service.rewriteParagraph).toHaveBeenCalledWith(
        'old paragraph',
        'make it vivid',
        'zh',
      );
      expect(result).toEqual({ rewritten: 'new paragraph' });
    });
  });

  describe('continueWriting', () => {
    it('should delegate to aiService.continueWriting', async () => {
      const data = {
        content: 'existing text',
        prompt: 'Common App #1',
        direction: 'hopeful',
      } as any;
      const result = await controller.continueWriting(mockUser as any, data);

      expect(service.continueWriting).toHaveBeenCalledWith(
        'existing text',
        'Common App #1',
        'hopeful',
        'zh',
      );
      expect(result).toEqual({ continuation: 'more text' });
    });
  });

  describe('generateOpening', () => {
    it('should delegate to aiService.generateOpening', async () => {
      const data = { prompt: 'Why us?', background: 'science passion' } as any;
      const result = await controller.generateOpening(mockUser as any, data);

      expect(service.generateOpening).toHaveBeenCalledWith(
        'Why us?',
        'science passion',
        'zh',
      );
      expect(result).toEqual({ opening: 'It was a dark...' });
    });
  });

  describe('generateEnding', () => {
    it('should delegate to aiService.generateEnding', async () => {
      const data = { content: 'essay body', prompt: 'Common App #1' } as any;
      const result = await controller.generateEnding(mockUser as any, data);

      expect(service.generateEnding).toHaveBeenCalledWith(
        'essay body',
        'Common App #1',
        'zh',
      );
      expect(result).toEqual({ ending: 'In conclusion...' });
    });
  });
});
