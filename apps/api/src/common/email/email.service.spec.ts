import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';
import * as nodemailer from 'nodemailer';

// Mock nodemailer
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-id' }),
  }),
}));

describe('EmailService', () => {
  let service: EmailService;
  let configService: ConfigService;

  const smtpConfig: Record<string, any> = {
    SMTP_HOST: 'smtp.test.com',
    SMTP_PORT: 587,
    SMTP_USER: 'test@test.com',
    SMTP_PASS: 'password',
    EMAIL_FROM: 'noreply@test.com',
    EMAIL_FROM_NAME: 'Test Platform',
    FRONTEND_URL: 'https://app.test.com',
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => smtpConfig[key]),
          },
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('constructor / initializeTransporter', () => {
    it('should initialize transporter when SMTP config is present', () => {
      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        host: 'smtp.test.com',
        port: 587,
        secure: false,
        auth: {
          user: 'test@test.com',
          pass: 'password',
        },
      });
    });

    it('should not initialize transporter when SMTP config is missing', async () => {
      jest.clearAllMocks();

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

      const serviceNoSmtp = module.get<EmailService>(EmailService);
      expect(serviceNoSmtp).toBeDefined();
      // createTransport should NOT be called again after clearAllMocks
      expect(nodemailer.createTransport).not.toHaveBeenCalled();
    });

    it('should set secure to true when SMTP_PORT is 465', async () => {
      jest.clearAllMocks();

      const secureConfig: Record<string, any> = {
        ...smtpConfig,
        SMTP_PORT: 465,
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          EmailService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => secureConfig[key]),
            },
          },
        ],
      }).compile();

      module.get<EmailService>(EmailService);
      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({ secure: true, port: 465 }),
      );
    });
  });

  describe('sendEmail', () => {
    it('should send email successfully via transporter', async () => {
      const result = await service.sendEmail({
        to: 'user@example.com',
        subject: 'Test Subject',
        html: '<p>Hello</p>',
      });

      expect(result).toBe(true);

      const transporter = (nodemailer.createTransport as jest.Mock).mock
        .results[0].value;
      expect(transporter.sendMail).toHaveBeenCalledWith({
        from: '"Test Platform" <noreply@test.com>',
        to: 'user@example.com',
        subject: 'Test Subject',
        html: '<p>Hello</p>',
        text: 'Hello',
      });
    });

    it('should return false on transporter error', async () => {
      const transporter = (nodemailer.createTransport as jest.Mock).mock
        .results[0].value;
      transporter.sendMail.mockRejectedValueOnce(new Error('SMTP error'));

      const result = await service.sendEmail({
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>test</p>',
      });

      expect(result).toBe(false);
    });

    it('should log mock email when no transporter is configured', async () => {
      jest.clearAllMocks();

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

      const serviceNoSmtp = module.get<EmailService>(EmailService);

      const result = await serviceNoSmtp.sendEmail({
        to: 'user@example.com',
        subject: 'Mock Test',
        html: '<p>mock</p>',
      });

      expect(result).toBe(true);
      // transporter.sendMail should never have been called
      expect(nodemailer.createTransport).not.toHaveBeenCalled();
    });

    it('should handle array recipients', async () => {
      const result = await service.sendEmail({
        to: ['a@test.com', 'b@test.com'],
        subject: 'Multi',
        html: '<p>multi</p>',
      });

      expect(result).toBe(true);

      const transporter = (nodemailer.createTransport as jest.Mock).mock
        .results[0].value;
      expect(transporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'a@test.com, b@test.com',
        }),
      );
    });

    it('should use provided text instead of converting html', async () => {
      await service.sendEmail({
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>HTML content</p>',
        text: 'Plain text override',
      });

      const transporter = (nodemailer.createTransport as jest.Mock).mock
        .results[0].value;
      expect(transporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Plain text override',
        }),
      );
    });
  });

  describe('sendVerificationEmail', () => {
    it('should send with correct subject and verification URL', async () => {
      const transporter = (nodemailer.createTransport as jest.Mock).mock
        .results[0].value;

      const result = await service.sendVerificationEmail(
        'user@example.com',
        'verify-token-123',
      );

      expect(result).toBe(true);
      expect(transporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: '验证您的邮箱 - 留学申请平台',
        }),
      );

      const callArgs = transporter.sendMail.mock.calls[0][0];
      expect(callArgs.html).toContain(
        'https://app.test.com/verify-email/callback?token=verify-token-123',
      );
    });
  });

  describe('sendWelcomeEmail', () => {
    it('should send with correct subject', async () => {
      const transporter = (nodemailer.createTransport as jest.Mock).mock
        .results[0].value;

      const result = await service.sendWelcomeEmail(
        'user@example.com',
        'Alice',
      );

      expect(result).toBe(true);
      expect(transporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: '欢迎加入留学申请平台！',
        }),
      );
    });

    it('should include user name in the HTML when provided', async () => {
      const transporter = (nodemailer.createTransport as jest.Mock).mock
        .results[0].value;

      await service.sendWelcomeEmail('user@example.com', 'Alice');

      const callArgs = transporter.sendMail.mock.calls[0][0];
      expect(callArgs.html).toContain('Alice');
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('should send with correct subject and reset URL', async () => {
      const transporter = (nodemailer.createTransport as jest.Mock).mock
        .results[0].value;

      const result = await service.sendPasswordResetEmail(
        'user@example.com',
        'reset-token-456',
      );

      expect(result).toBe(true);
      expect(transporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: '重置密码 - 留学申请平台',
        }),
      );

      const callArgs = transporter.sendMail.mock.calls[0][0];
      expect(callArgs.html).toContain(
        'https://app.test.com/reset-password?token=reset-token-456',
      );
    });
  });

  describe('htmlToText (via sendEmail)', () => {
    it('should strip HTML tags', async () => {
      const transporter = (nodemailer.createTransport as jest.Mock).mock
        .results[0].value;

      await service.sendEmail({
        to: 'user@example.com',
        subject: 'Test',
        html: '<h1>Title</h1><p>Paragraph <strong>bold</strong></p>',
      });

      const callArgs = transporter.sendMail.mock.calls[0][0];
      expect(callArgs.text).not.toContain('<');
      expect(callArgs.text).not.toContain('>');
      expect(callArgs.text).toContain('Title');
      expect(callArgs.text).toContain('Paragraph');
      expect(callArgs.text).toContain('bold');
    });

    it('should collapse whitespace and trim', async () => {
      const transporter = (nodemailer.createTransport as jest.Mock).mock
        .results[0].value;

      await service.sendEmail({
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>  Hello   \n\n   World  </p>',
      });

      const callArgs = transporter.sendMail.mock.calls[0][0];
      expect(callArgs.text).toBe('Hello World');
    });
  });
});
