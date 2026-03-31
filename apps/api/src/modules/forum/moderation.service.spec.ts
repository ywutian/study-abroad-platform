import { Test, TestingModule } from '@nestjs/testing';
import { ForumModerationService } from './moderation.service';
import { BadRequestException } from '@nestjs/common';

describe('ForumModerationService', () => {
  let service: ForumModerationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ForumModerationService],
    }).compile();

    service = module.get<ForumModerationService>(ForumModerationService);
  });

  describe('filterContent', () => {
    it('should return isClean=true for normal content', async () => {
      const result = await service.filterContent(
        'This is a normal discussion about college applications.',
      );

      expect(result.isClean).toBe(true);
      expect(result.detectedSensitive).toHaveLength(0);
    });

    it('should detect sensitive ad/spam words', async () => {
      const result = await service.filterContent('加群领取代写服务，QQ群12345');

      expect(result.isClean).toBe(false);
      expect(result.detectedSensitive.length).toBeGreaterThan(0);
    });

    it('should detect inappropriate language', async () => {
      const result = await service.filterContent('你就是个废物智障');

      expect(result.isClean).toBe(false);
      expect(result.detectedSensitive.length).toBeGreaterThan(0);
    });

    it('should detect false guarantee patterns', async () => {
      const result = await service.filterContent('我们保录取，100%录取名校');

      expect(result.isClean).toBe(false);
      expect(result.detectedSensitive.length).toBeGreaterThan(0);
    });

    it('should replace sensitive words with asterisks in filteredContent', async () => {
      const result = await service.filterContent('请加我微信号获取代写');

      expect(result.filteredContent).not.toContain('微信号');
      expect(result.filteredContent).toContain('***');
    });

    it('should detect suspicious words without blocking', async () => {
      const result = await service.filterContent('免费咨询，限时优惠中');

      expect(result.isClean).toBe(true); // Not blocked
      expect(result.hasSuspicious).toBe(true);
      expect(result.detectedSuspicious.length).toBeGreaterThan(0);
    });
  });

  describe('validateContent', () => {
    it('should not throw for clean content', async () => {
      await expect(
        service.validateContent('Normal post about SAT prep'),
      ).resolves.not.toThrow();
    });

    it('should throw BadRequestException for sensitive content', async () => {
      await expect(
        service.validateContent('加微信号获取代写服务', '标题'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('validateMultiple', () => {
    it('should pass when all texts are clean', async () => {
      await expect(
        service.validateMultiple([
          { content: 'Clean title', context: '标题' },
          { content: 'Clean content', context: '内容' },
        ]),
      ).resolves.not.toThrow();
    });

    it('should throw on first sensitive text found', async () => {
      await expect(
        service.validateMultiple([
          { content: 'Clean title', context: '标题' },
          { content: '保录取服务', context: '内容' },
        ]),
      ).rejects.toThrow(BadRequestException);
    });

    it('should skip empty content strings', async () => {
      await expect(
        service.validateMultiple([
          { content: '', context: '空内容' },
          { content: 'Normal text', context: '正文' },
        ]),
      ).resolves.not.toThrow();
    });
  });

  describe('containsUrl', () => {
    it('should detect http URLs', () => {
      expect(service.containsUrl('Visit http://example.com')).toBe(true);
    });

    it('should detect https URLs', () => {
      expect(service.containsUrl('See https://example.com/path')).toBe(true);
    });

    it('should detect www URLs', () => {
      expect(service.containsUrl('Go to www.example.com')).toBe(true);
    });

    it('should return false for plain text', () => {
      expect(service.containsUrl('No links here')).toBe(false);
    });
  });

  describe('hasExcessiveRepetition', () => {
    it('should detect excessive character repetition', () => {
      expect(service.hasExcessiveRepetition('aaaaaaa')).toBe(true);
    });

    it('should return false for normal text', () => {
      expect(service.hasExcessiveRepetition('Hello world')).toBe(false);
    });
  });

  describe('comprehensiveCheck', () => {
    it('should pass clean content with no warnings', async () => {
      const result = await service.comprehensiveCheck(
        'A well-written post about college life with sufficient length.',
      );

      expect(result.passed).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail content with sensitive words', async () => {
      const result = await service.comprehensiveCheck(
        '加微信号代写essay保录取名校，100%录取',
      );

      expect(result.passed).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should warn on short content', async () => {
      const result = await service.comprehensiveCheck('Hi');

      expect(result.passed).toBe(true);
      expect(result.warnings).toContain('内容过短，建议丰富内容');
    });

    it('should warn on external links', async () => {
      const result = await service.comprehensiveCheck(
        'Check out this link: https://example.com for more details on applications.',
      );

      expect(result.passed).toBe(true);
      expect(result.warnings).toContain('内容包含外部链接');
    });

    it('should warn on excessive repetition', async () => {
      const result = await service.comprehensiveCheck(
        'This is a test with aaaaaaaaa lots of repeated characters in a sentence.',
      );

      expect(result.passed).toBe(true);
      expect(result.warnings).toContain('内容包含大量重复字符');
    });
  });
});
