import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../../common/email/email.service';
import { UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
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
  let jwtService: JwtService;
  let emailService: EmailService;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    passwordHash: 'hashed_password',
    role: 'USER',
    emailVerified: false,
    locale: 'zh',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            refreshToken: {
              findUnique: jest.fn(),
              create: jest.fn(),
              delete: jest.fn(),
              deleteMany: jest.fn(),
            },
            user: {
              findFirst: jest.fn(),
              update: jest.fn(),
            },
          },
        },
        {
          provide: UserService,
          useValue: {
            findByEmail: jest.fn(),
            findById: jest.fn(),
            findByIdOrThrow: jest.fn(),
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
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prismaService = module.get<PrismaService>(PrismaService);
    userService = module.get<UserService>(UserService);
    jwtService = module.get<JwtService>(JwtService);
    emailService = module.get<EmailService>(EmailService);
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

      (prismaService.refreshToken.findUnique as jest.Mock).mockResolvedValue(storedToken);
      (userService.findById as jest.Mock).mockResolvedValue(mockUser);
      (prismaService.refreshToken.delete as jest.Mock).mockResolvedValue(undefined);
      (prismaService.refreshToken.create as jest.Mock).mockResolvedValue({
        token: 'new_refresh_token',
      });

      const result = await service.refreshToken('valid_refresh_token');

      expect(result.accessToken).toBe('mock_access_token');
      expect(prismaService.refreshToken.delete).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if token not found', async () => {
      (prismaService.refreshToken.findUnique as jest.Mock).mockResolvedValue(null);

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

      (prismaService.refreshToken.findUnique as jest.Mock).mockResolvedValue(expiredToken);

      await expect(service.refreshToken('expired_token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('verifyEmail', () => {
    it('should verify email successfully', async () => {
      (prismaService.user.findFirst as jest.Mock).mockResolvedValue(mockUser);
      (prismaService.user.update as jest.Mock).mockResolvedValue({
        ...mockUser,
        emailVerified: true,
      });

      const result = await service.verifyEmail('valid_token');

      expect(result.message).toContain('verified successfully');
    });

    it('should throw BadRequestException with invalid token', async () => {
      (prismaService.user.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.verifyEmail('invalid_token')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('logout', () => {
    it('should delete specific refresh token (hashed)', async () => {
      await service.logout('user-123', 'refresh_token');

      // Token is now hashed before querying
      expect(prismaService.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { token: expect.any(String) },
      });
    });

    it('should delete all refresh tokens if no token provided', async () => {
      await service.logout('user-123');

      expect(prismaService.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
      });
    });
  });
});
