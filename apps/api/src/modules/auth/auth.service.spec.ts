import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../../common/email/email.service';
import { SessionManager } from './session-manager.service';
import { BruteForceService } from './brute-force.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';

// Mock bcrypt
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed_password'),
  compare: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let prismaService: PrismaService;
  let userService: UserService;
  let _jwtService: JwtService;
  let emailService: EmailService;
  let sessionManager: SessionManager;
  let bruteForceService: BruteForceService;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    passwordHash: 'hashed_password',
    role: 'USER',
    emailVerified: true,
    lastLoginAt: null,
    locale: 'zh',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    points: 120,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useFactory: () => {
            const prismaValue: any = {
              refreshToken: {
                findUnique: jest.fn(),
                findMany: jest.fn().mockResolvedValue([]),
                create: jest.fn(),
                delete: jest.fn(),
                deleteMany: jest.fn(),
              },
              user: {
                findFirst: jest.fn(),
                update: jest.fn(),
                create: jest.fn(),
              },
              operatorInvite: {
                findUnique: jest.fn(),
                updateMany: jest.fn(),
              },
              // $transaction executes the callback with the prisma mock itself
              $transaction: jest.fn((fn: (tx: any) => Promise<any>) =>
                fn(prismaValue),
              ),
            };
            return prismaValue;
          },
        },
        {
          provide: UserService,
          useValue: {
            findByEmail: jest.fn(),
            findById: jest.fn(),
            findByIdOrThrow: jest.fn(),
            validateReferralCode: jest.fn().mockResolvedValue(null),
            create: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock_access_token'),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('7d'),
          },
        },
        {
          provide: EmailService,
          useValue: {
            sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
            sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
            sendWelcomeEmail: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: SessionManager,
          useValue: {
            createSession: jest.fn().mockResolvedValue(undefined),
            invalidateToken: jest.fn().mockResolvedValue(undefined),
            invalidateAllSessions: jest.fn().mockResolvedValue(undefined),
            getSessionStats: jest.fn().mockResolvedValue({
              totalSessions: 0,
              activeSessions: 0,
              expiredSessions: 0,
            }),
          },
        },
        {
          provide: BruteForceService,
          useValue: {
            isLocked: jest.fn().mockResolvedValue(false),
            recordFailedAttempt: jest.fn().mockResolvedValue(undefined),
            resetAttempts: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prismaService = module.get<PrismaService>(PrismaService);
    userService = module.get<UserService>(UserService);
    _jwtService = module.get<JwtService>(JwtService);
    emailService = module.get<EmailService>(EmailService);
    sessionManager = module.get<SessionManager>(SessionManager);
    bruteForceService = module.get<BruteForceService>(BruteForceService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      (userService.findByEmail as jest.Mock).mockResolvedValue(null);
      (userService.create as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.register({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.user.email).toBe('test@example.com');
      expect(result.user).not.toHaveProperty('points');
      expect(result.message).toContain('Registration successful');
      expect(emailService.sendVerificationEmail).toHaveBeenCalled();
    });

    it('should throw ConflictException if email already exists', async () => {
      (userService.findByEmail as jest.Mock).mockResolvedValue(mockUser);

      await expect(
        service.register({
          email: 'test@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('isEmailAvailable', () => {
    it('returns true when no user has the email', async () => {
      (userService.findByEmail as jest.Mock).mockResolvedValue(null);
      await expect(service.isEmailAvailable('new@example.com')).resolves.toBe(
        true,
      );
    });

    it('returns false when the email is already registered', async () => {
      (userService.findByEmail as jest.Mock).mockResolvedValue(mockUser);
      await expect(service.isEmailAvailable('taken@example.com')).resolves.toBe(
        false,
      );
    });
  });

  describe('login', () => {
    it('should login successfully with valid credentials', async () => {
      (userService.findByEmail as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (prismaService.refreshToken.create as jest.Mock).mockResolvedValue({
        token: 'refresh_token',
      });

      const result = await service.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.user.email).toBe('test@example.com');
      expect(result.user).not.toHaveProperty('points');
      expect(result.tokens.accessToken).toBe('mock_access_token');
    });

    it('should throw UnauthorizedException with invalid password', async () => {
      (userService.findByEmail as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({
          email: 'test@example.com',
          password: 'wrong_password',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user not found', async () => {
      (userService.findByEmail as jest.Mock).mockResolvedValue(null);

      await expect(
        service.login({
          email: 'nonexistent@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user is deleted', async () => {
      (userService.findByEmail as jest.Mock).mockResolvedValue({
        ...mockUser,
        deletedAt: new Date(),
      });

      await expect(
        service.login({
          email: 'test@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refreshToken', () => {
    it('should refresh tokens successfully', async () => {
      const storedToken = {
        id: 'token-123',
        token: 'valid_refresh_token',
        userId: mockUser.id,
        expiresAt: new Date(Date.now() + 86400000), // 1 day from now
      };

      (prismaService.refreshToken.findUnique as jest.Mock).mockResolvedValue(
        storedToken,
      );
      (userService.findById as jest.Mock).mockResolvedValue(mockUser);
      (prismaService.refreshToken.delete as jest.Mock).mockResolvedValue(
        undefined,
      );
      (prismaService.refreshToken.create as jest.Mock).mockResolvedValue({
        token: 'new_refresh_token',
      });

      const result = await service.refreshToken('valid_refresh_token');

      expect(result.accessToken).toBe('mock_access_token');
      expect(prismaService.refreshToken.delete).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if token not found', async () => {
      (prismaService.refreshToken.findUnique as jest.Mock).mockResolvedValue(
        null,
      );

      await expect(service.refreshToken('invalid_token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if token expired', async () => {
      const expiredToken = {
        id: 'token-123',
        token: 'expired_token',
        userId: mockUser.id,
        expiresAt: new Date(Date.now() - 86400000), // 1 day ago
      };

      (prismaService.refreshToken.findUnique as jest.Mock).mockResolvedValue(
        expiredToken,
      );

      await expect(service.refreshToken('expired_token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('verifyEmail', () => {
    const future = new Date(Date.now() + 60 * 60 * 1000);

    it('should verify a fresh (unverified) token successfully', async () => {
      (prismaService.user.findFirst as jest.Mock).mockResolvedValue({
        ...mockUser,
        emailVerified: false,
        emailVerifyTokenExp: future,
      });
      (prismaService.user.update as jest.Mock).mockResolvedValue({
        ...mockUser,
        emailVerified: true,
      });

      const result = await service.verifyEmail('valid_token');

      expect(result.message).toContain('verified successfully');
      expect(prismaService.user.update).toHaveBeenCalled();
    });

    it('is idempotent — already-verified token returns success, not a 400 (prefetch/double-hit)', async () => {
      (prismaService.user.findFirst as jest.Mock).mockResolvedValue({
        ...mockUser,
        emailVerified: true,
      });

      const result = await service.verifyEmail('already_used_token');

      expect(result.message).toContain('already verified');
      // No second write — the first hit already flipped it.
      expect(prismaService.user.update).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException with invalid token', async () => {
      (prismaService.user.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.verifyEmail('invalid_token')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for an expired token on an unverified user', async () => {
      (prismaService.user.findFirst as jest.Mock).mockResolvedValue({
        ...mockUser,
        emailVerified: false,
        emailVerifyTokenExp: new Date(Date.now() - 60 * 60 * 1000),
      });

      await expect(service.verifyEmail('expired_token')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('logout', () => {
    it('should invalidate specific refresh token', async () => {
      await service.logout('user-123', 'refresh_token');

      expect(sessionManager.invalidateToken).toHaveBeenCalledWith(
        'refresh_token',
      );
      expect(sessionManager.invalidateAllSessions).not.toHaveBeenCalled();
    });

    it('should invalidate all sessions if no token provided', async () => {
      await service.logout('user-123');

      expect(sessionManager.invalidateAllSessions).toHaveBeenCalledWith(
        'user-123',
      );
      expect(sessionManager.invalidateToken).not.toHaveBeenCalled();
    });
  });

  // ====== Phase 1.2: New test coverage ======

  describe('login (additional)', () => {
    it('should throw UnauthorizedException when brute-force locked', async () => {
      (bruteForceService.isLocked as jest.Mock).mockResolvedValue(true);

      await expect(
        service.login({ email: 'test@example.com', password: 'password123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should record failed attempt for non-existent user', async () => {
      (userService.findByEmail as jest.Mock).mockResolvedValue(null);

      await expect(
        service.login({ email: 'unknown@example.com', password: 'pass' }),
      ).rejects.toThrow(UnauthorizedException);
      expect(bruteForceService.recordFailedAttempt).toHaveBeenCalledWith(
        'unknown@example.com',
      );
    });

    it('should record failed attempt for wrong password', async () => {
      (userService.findByEmail as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ email: 'test@example.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
      expect(bruteForceService.recordFailedAttempt).toHaveBeenCalledWith(
        'test@example.com',
      );
    });

    it('should reset brute-force attempts on successful login', async () => {
      (userService.findByEmail as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (prismaService.refreshToken.create as jest.Mock).mockResolvedValue({
        token: 'rt',
      });

      await service.login({ email: 'test@example.com', password: 'pass' });

      expect(bruteForceService.resetAttempts).toHaveBeenCalledWith(
        'test@example.com',
      );
    });

    it('logs in an unverified user (soft nudge, not a login wall)', async () => {
      (userService.findByEmail as jest.Mock).mockResolvedValue({
        ...mockUser,
        emailVerified: false,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (prismaService.refreshToken.create as jest.Mock).mockResolvedValue({
        token: 'rt',
      });

      const result = await service.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.tokens.accessToken).toBeDefined();
      expect(result.user.emailVerified).toBe(false);
    });
  });

  describe('resendVerificationEmail', () => {
    it('should return generic message when user not found', async () => {
      (userService.findByEmail as jest.Mock).mockResolvedValue(null);

      const result = await service.resendVerificationEmail('unknown@test.com');

      expect(result.message).toContain('If the email exists');
    });

    it('should throw BadRequestException if email already verified', async () => {
      (userService.findByEmail as jest.Mock).mockResolvedValue(mockUser);

      await expect(
        service.resendVerificationEmail('test@example.com'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should generate new token and send email for unverified user', async () => {
      (userService.findByEmail as jest.Mock).mockResolvedValue({
        ...mockUser,
        emailVerified: false,
      });
      (prismaService.user.update as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.resendVerificationEmail('test@example.com');

      expect(result.message).toContain('If the email exists');
      expect(prismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockUser.id },
          data: expect.objectContaining({
            emailVerifyToken: expect.any(String),
            emailVerifyTokenExp: expect.any(Date),
          }),
        }),
      );
      expect(emailService.sendVerificationEmail).toHaveBeenCalled();
    });
  });

  describe('requestPasswordReset', () => {
    it('should return generic message when user not found', async () => {
      (userService.findByEmail as jest.Mock).mockResolvedValue(null);

      const result = await service.requestPasswordReset('unknown@test.com');

      expect(result.message).toContain('If the email exists');
    });

    it('should set reset token and send email for valid user', async () => {
      (userService.findByEmail as jest.Mock).mockResolvedValue(mockUser);
      (prismaService.user.update as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.requestPasswordReset('test@example.com');

      expect(result.message).toContain('If the email exists');
      expect(prismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockUser.id },
          data: expect.objectContaining({
            passwordResetToken: expect.any(String),
            passwordResetExpires: expect.any(Date),
          }),
        }),
      );
      expect(emailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        'test@example.com',
        expect.any(String),
      );
    });
  });

  describe('resetPassword', () => {
    it('should reset password with valid token', async () => {
      (prismaService.user.findFirst as jest.Mock).mockResolvedValue(mockUser);
      (prismaService.user.update as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.resetPassword('valid_token', 'newpass123');

      expect(result.message).toContain('Password reset successful');
      expect(prismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockUser.id },
          data: expect.objectContaining({
            passwordHash: 'hashed_password',
            passwordResetToken: null,
            passwordResetExpires: null,
          }),
        }),
      );
      expect(sessionManager.invalidateAllSessions).toHaveBeenCalledWith(
        mockUser.id,
      );
    });

    it('should throw BadRequestException for invalid/expired token', async () => {
      (prismaService.user.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.resetPassword('expired_token', 'newpass123'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('changePassword', () => {
    it('should change password with correct current password', async () => {
      (userService.findByIdOrThrow as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (prismaService.user.update as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.changePassword(
        'user-123',
        'oldpass',
        'newpass',
      );

      expect(result.message).toContain('Password changed successfully');
      expect(prismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-123' },
          data: { passwordHash: 'hashed_password' },
        }),
      );
      expect(sessionManager.invalidateAllSessions).toHaveBeenCalledWith(
        'user-123',
      );
    });

    it('should throw UnauthorizedException with wrong current password', async () => {
      (userService.findByIdOrThrow as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changePassword('user-123', 'wrong', 'newpass'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('session limit (generateTokens)', () => {
    it('should delete oldest tokens when session limit (5) is exceeded', async () => {
      const existingTokens = Array.from({ length: 6 }, (_, i) => ({
        id: `token-${i}`,
        token: `rt-${i}`,
        userId: mockUser.id,
        createdAt: new Date(Date.now() - (6 - i) * 3600000),
      }));

      (userService.findByEmail as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (prismaService.refreshToken.findMany as jest.Mock).mockResolvedValue(
        existingTokens,
      );
      (prismaService.refreshToken.create as jest.Mock).mockResolvedValue({
        token: 'new_rt',
      });

      await service.login({ email: 'test@example.com', password: 'pass' });

      // Should delete oldest 2 tokens (6 - 4 = 2) to keep only 4, making room for the new one
      expect(prismaService.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['token-0', 'token-1'] },
        },
      });
    });

    it('should not delete tokens when under session limit', async () => {
      const existingTokens = Array.from({ length: 3 }, (_, i) => ({
        id: `token-${i}`,
        token: `rt-${i}`,
        userId: mockUser.id,
        createdAt: new Date(),
      }));

      (userService.findByEmail as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (prismaService.refreshToken.findMany as jest.Mock).mockResolvedValue(
        existingTokens,
      );
      (prismaService.refreshToken.create as jest.Mock).mockResolvedValue({
        token: 'new_rt',
      });

      await service.login({ email: 'test@example.com', password: 'pass' });

      expect(prismaService.refreshToken.deleteMany).not.toHaveBeenCalled();
    });
  });
  describe('registerWithInvite — invite consumption', () => {
    // The `if (invite.usedBy)` guard runs before the transaction, so two
    // requests carrying the same token both read `usedBy: null` and both
    // reach the consume. OperatorInvite has no unique constraint on usedBy,
    // and the role granted is invite.role — OPERATOR by default — so an
    // unconditional update-by-id let one invite mint two privileged accounts.

    const validInvite = {
      id: 'inv-1',
      token: 'tok-1',
      email: null,
      role: 'OPERATOR',
      usedBy: null,
      expiresAt: new Date(Date.now() + 3_600_000),
    };
    const dto = {
      email: 'op@example.com',
      password: 'password123',
      inviteToken: 'tok-1',
      locale: 'zh',
    };

    beforeEach(() => {
      (prismaService as any).operatorInvite.findUnique.mockResolvedValue(
        validInvite,
      );
      (userService.findByEmail as jest.Mock).mockResolvedValue(null);
      (prismaService as any).user.create.mockResolvedValue({
        ...mockUser,
        role: 'OPERATOR',
      });
      (prismaService as any).operatorInvite.updateMany.mockResolvedValue({
        count: 1,
      });
    });

    it('claims the invite conditionally on usedBy being null', async () => {
      await service.registerWithInvite(dto);

      expect(
        (prismaService as any).operatorInvite.updateMany,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inv-1', usedBy: null },
        }),
      );
      // never an unconditional update-by-id
      expect((prismaService as any).operatorInvite.update).toBeUndefined();
    });

    it('rejects the loser of a race instead of minting a second operator', async () => {
      // The other request committed first, so the conditional claim matches
      // nothing even though the pre-transaction read saw usedBy: null.
      (prismaService as any).operatorInvite.updateMany.mockResolvedValue({
        count: 0,
      });

      await expect(service.registerWithInvite(dto as never)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('takes the role from the invite, never from the request body', async () => {
      await service.registerWithInvite({
        ...dto,
        role: 'SUPER_ADMIN',
      } as never);

      expect((prismaService as any).user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ role: 'OPERATOR' }),
        }),
      );
    });
  });
});
