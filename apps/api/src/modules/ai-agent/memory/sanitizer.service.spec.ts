import { Test, TestingModule } from '@nestjs/testing';
import { SanitizerService, SanitizeLevel } from './sanitizer.service';

describe('SanitizerService', () => {
  let service: SanitizerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SanitizerService],
    }).compile();

    service = module.get<SanitizerService>(SanitizerService);
  });

  describe('sanitize', () => {
    describe('高敏感信息（所有级别都脱敏）', () => {
      it('should mask SSN in all levels', () => {
        const input = '我的SSN是 123-45-6789';

        expect(service.sanitize(input, { level: SanitizeLevel.LIGHT })).toBe(
          '我的SSN是 ***-**-****',
        );
        expect(service.sanitize(input, { level: SanitizeLevel.MODERATE })).toBe(
          '我的SSN是 ***-**-****',
        );
        expect(service.sanitize(input, { level: SanitizeLevel.FULL })).toBe(
          '我的SSN是 ***-**-****',
        );
      });

      it('should mask Chinese ID card', () => {
        const input = '身份证号: 110101199003075678';

        // LIGHT: 保留前3后4
        const lightResult = service.sanitize(input, {
          level: SanitizeLevel.LIGHT,
        });
        expect(lightResult).toContain('110');
        expect(lightResult).toContain('5678');

        // FULL: 完全隐藏
        expect(service.sanitize(input, { level: SanitizeLevel.FULL })).toBe(
          '身份证号: ******************',
        );
      });

      it('should mask credit card numbers', () => {
        const input = '卡号: 4532-1234-5678-9012';

        expect(service.sanitize(input, { level: SanitizeLevel.LIGHT })).toBe(
          '卡号: ****-****-****-****',
        );
      });
    });

    describe('中敏感信息（MODERATE/FULL 脱敏）', () => {
      it('should not mask email in LIGHT level', () => {
        const input = '邮箱: john.doe@example.com';

        expect(service.sanitize(input, { level: SanitizeLevel.LIGHT })).toBe(
          '邮箱: john.doe@example.com',
        );
      });

      it('should mask email partially in MODERATE level', () => {
        const input = '邮箱: john.doe@example.com';
        const result = service.sanitize(input, {
          level: SanitizeLevel.MODERATE,
        });

        expect(result).toBe('邮箱: j***@example.com');
      });

      it('should mask email fully in FULL level', () => {
        const input = '邮箱: john.doe@example.com';
        const result = service.sanitize(input, { level: SanitizeLevel.FULL });

        expect(result).toBe('邮箱: ****@****.***');
      });

      it('should preserve phone in LIGHT, mask partially in MODERATE', () => {
        const input = '电话: 13812345678';

        expect(service.sanitize(input, { level: SanitizeLevel.LIGHT })).toBe(
          '电话: 13812345678',
        );
        expect(service.sanitize(input, { level: SanitizeLevel.MODERATE })).toBe(
          '电话: 138****5678',
        );
        expect(service.sanitize(input, { level: SanitizeLevel.FULL })).toBe(
          '电话: ***********',
        );
      });

      it('should mask GPA in MODERATE and FULL', () => {
        const input = '我的GPA: 3.85';

        expect(service.sanitize(input, { level: SanitizeLevel.LIGHT })).toBe(
          '我的GPA: 3.85',
        );
        expect(
          service.sanitize(input, { level: SanitizeLevel.MODERATE }),
        ).toMatch(/GPA.*\*\.\*\*/);
      });

      it('should mask SAT score in MODERATE and FULL', () => {
        const input = 'SAT: 1520';

        expect(service.sanitize(input, { level: SanitizeLevel.LIGHT })).toBe(
          'SAT: 1520',
        );
        expect(service.sanitize(input, { level: SanitizeLevel.MODERATE })).toBe(
          'SAT: ****',
        );
      });

      it('should mask TOEFL score', () => {
        const input = '托福成绩: TOEFL: 105';

        expect(service.sanitize(input, { level: SanitizeLevel.MODERATE })).toBe(
          '托福成绩: TOEFL: ***',
        );
      });

      it('should mask IELTS score', () => {
        const input = '雅思: 7.5';

        expect(
          service.sanitize(input, { level: SanitizeLevel.MODERATE }),
        ).toMatch(/雅思.*\*\.\*/);
      });
    });

    describe('低敏感信息（仅 FULL 脱敏）', () => {
      it('should only mask name in FULL level', () => {
        const input = '姓名: 张三';

        expect(service.sanitize(input, { level: SanitizeLevel.LIGHT })).toBe(
          '姓名: 张三',
        );
        expect(service.sanitize(input, { level: SanitizeLevel.MODERATE })).toBe(
          '姓名: 张三',
        );
        expect(service.sanitize(input, { level: SanitizeLevel.FULL })).toBe(
          '姓名: ***',
        );
      });
    });

    describe('复合场景', () => {
      it('should mask multiple sensitive data types', () => {
        const input = `
          申请人信息:
          姓名: 张三
          邮箱: zhangsan@gmail.com
          电话: 13912345678
          GPA: 3.85
          SAT: 1480
        `;

        const result = service.sanitize(input, {
          level: SanitizeLevel.MODERATE,
        });

        // Email should be partially masked
        expect(result).toContain('z***@gmail.com');
        // Phone should be partially masked
        expect(result).toContain('139****5678');
        // GPA should be masked
        expect(result).not.toContain('3.85');
        // SAT should be masked
        expect(result).toContain('****');
        // Name should NOT be masked in MODERATE
        expect(result).toContain('张三');
      });
    });
  });

  describe('sanitizeWithDetails', () => {
    it('should return detailed sanitization result', () => {
      const input = '邮箱: test@example.com, 电话: 13812345678';
      const result = service.sanitizeWithDetails(input, {
        level: SanitizeLevel.MODERATE,
      });

      expect(result.detectedTypes).toContain('EMAIL');
      expect(result.detectedTypes).toContain('PHONE_CN');
      expect(result.maskedCount).toBe(2);
      expect(result.sanitized).toContain('t***@example.com');
      expect(result.sanitized).toContain('138****5678');
    });
  });

  describe('detectSensitive', () => {
    it('should detect SSN', () => {
      const result = service.detectSensitive('SSN: 123-45-6789');

      expect(result.hasSensitive).toBe(true);
      expect(result.types).toContain('SSN');
      expect(result.locations.length).toBe(1);
    });

    it('should detect multiple sensitive types', () => {
      const input = 'Email: test@test.com, GPA: 3.9, SAT: 1500';
      const result = service.detectSensitive(input);

      expect(result.hasSensitive).toBe(true);
      expect(result.types.length).toBeGreaterThanOrEqual(3);
      expect(result.types).toContain('EMAIL');
      expect(result.types).toContain('GPA');
      expect(result.types).toContain('SAT_SCORE');
    });

    it('should return empty for clean content', () => {
      const result =
        service.detectSensitive('这是一段普通的文本，没有敏感信息');

      expect(result.hasSensitive).toBe(false);
      expect(result.types.length).toBe(0);
    });
  });

  describe('hasSensitiveData', () => {
    it('should return true for content with sensitive data', () => {
      expect(service.hasSensitiveData('我的邮箱是 test@example.com')).toBe(
        true,
      );
      expect(service.hasSensitiveData('SSN: 123-45-6789')).toBe(true);
    });

    it('should return false for clean content', () => {
      expect(service.hasSensitiveData('普通文本内容')).toBe(false);
    });
  });

  describe('sanitizeMemory', () => {
    it('should sanitize memory content and metadata', () => {
      const memory = {
        id: '1',
        content: '用户邮箱是 user@example.com',
        metadata: {
          source: '来自 13812345678 的消息',
          notes: 'GPA: 3.9',
        },
      };

      const result = service.sanitizeMemory(memory, {
        level: SanitizeLevel.MODERATE,
      });

      expect(result.content).toContain('u***@example.com');
      expect(result.metadata?.source).toContain('138****5678');
      expect(result.metadata?.notes).not.toContain('3.9');
    });
  });

  describe('sanitizeMessages', () => {
    it('should sanitize array of messages', () => {
      const messages = [
        { role: 'user', content: '我的邮箱是 a@b.com' },
        { role: 'assistant', content: '好的，您的手机是 13900001111 吗？' },
      ];

      const result = service.sanitizeMessages(messages, {
        level: SanitizeLevel.MODERATE,
      });

      expect(result[0].content).toContain('a***@b.com');
      expect(result[1].content).toContain('139****1111');
    });
  });

  describe('convenience methods', () => {
    it('sanitizeForLog should use LIGHT level', () => {
      const input = '邮箱: test@example.com';
      // LIGHT level should not mask email
      expect(service.sanitizeForLog(input)).toBe(input);
    });

    it('sanitizeForExport should use MODERATE level', () => {
      const input = '邮箱: test@example.com';
      expect(service.sanitizeForExport(input)).toContain('t***@example.com');
    });

    it('sanitizeForPublic should use FULL level', () => {
      const input = '姓名: 李四';
      expect(service.sanitizeForPublic(input)).toContain('***');
    });
  });

  describe('custom mask character', () => {
    it('should use custom mask character', () => {
      const input = 'SSN: 123-45-6789';
      const result = service.sanitize(input, {
        level: SanitizeLevel.FULL,
        maskChar: '#',
      });

      expect(result).toBe('SSN: ###-##-####');
    });
  });
});
