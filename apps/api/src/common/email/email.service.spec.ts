import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';

// Mock resend
const mockSend = jest
  .fn()
  .mockResolvedValue({ data: { id: 'test-id' }, error: null });
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: mockSend },
  })),
}));

describe('EmailService', () => {
  let service: EmailService;

  const emailConfig: Record<string, any> = {
    RESEND_API_KEY: 're_test_key',
    EMAIL_FROM: 'noreply@test.com',
    EMAIL_FROM_NAME: 'Test Platform',
    FRONTEND_URL: 'https://app.test.com',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockSend.mockResolvedValue({ data: { id: 'test-id' }, error: null });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => emailConfig[key]),
          },
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendEmail', () => {
    it('should send email successfully via Resend', async () => {
      const result = await service.sendEmail({
        to: 'user@example.com',
        subject: 'Test Subject',
        html: '<p>Hello</p>',
      });

      expect(result).toBe(true);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'Test Platform <noreply@test.com>',
          to: ['user@example.com'],
          subject: 'Test Subject',
          html: '<p>Hello</p>',
        }),
      );
    });

    it('should return false on Resend error', async () => {
      mockSend.mockResolvedValueOnce({
        data: null,
        error: { message: 'Resend error' },
      });

      const result = await service.sendEmail({
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>test</p>',
      });

      expect(result).toBe(false);
    });

    it('should log mock email when no API key is configured', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          EmailService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn(() => undefined),
            },
          },
        ],
      }).compile();

      const serviceNoKey = module.get<EmailService>(EmailService);

      const result = await serviceNoKey.sendEmail({
        to: 'user@example.com',
        subject: 'Mock Test',
        html: '<p>mock</p>',
      });

      expect(result).toBe(true);
    });

    it('should handle array recipients', async () => {
      const result = await service.sendEmail({
        to: ['a@test.com', 'b@test.com'],
        subject: 'Multi',
        html: '<p>multi</p>',
      });

      expect(result).toBe(true);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ['a@test.com', 'b@test.com'],
        }),
      );
    });
  });

  describe('sendVerificationEmail', () => {
    it('should send with correct subject and verification URL', async () => {
      const result = await service.sendVerificationEmail(
        'user@example.com',
        'verify-token-123',
      );

      expect(result).toBe(true);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ['user@example.com'],
          subject: '验证您的邮箱 - 留学申请平台',
        }),
      );

      const callArgs = mockSend.mock.calls[0][0];
      expect(callArgs.html).toContain(
        'https://app.test.com/verify-email/callback?token=verify-token-123',
      );
    });
  });

  describe('sendWelcomeEmail', () => {
    it('should send with correct subject', async () => {
      const result = await service.sendWelcomeEmail(
        'user@example.com',
        'Alice',
      );

      expect(result).toBe(true);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ['user@example.com'],
          subject: '欢迎加入留学申请平台！',
        }),
      );
    });

    it('should include user name in the HTML when provided', async () => {
      await service.sendWelcomeEmail('user@example.com', 'Alice');

      const callArgs = mockSend.mock.calls[0][0];
      expect(callArgs.html).toContain('Alice');
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('should send with correct subject and reset URL', async () => {
      const result = await service.sendPasswordResetEmail(
        'user@example.com',
        'reset-token-456',
      );

      expect(result).toBe(true);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ['user@example.com'],
          subject: '重置密码 - 留学申请平台',
        }),
      );

      const callArgs = mockSend.mock.calls[0][0];
      expect(callArgs.html).toContain(
        'https://app.test.com/reset-password?token=reset-token-456',
      );
    });
  });
});
