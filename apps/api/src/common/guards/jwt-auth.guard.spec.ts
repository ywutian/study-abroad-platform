import {
  UnauthorizedException,
  ForbiddenException,
  ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

// Mock passport AuthGuard before importing the guard
jest.mock('@nestjs/passport', () => ({
  AuthGuard: () => {
    class MockAuthGuard {
      canActivate() {
        return Promise.resolve(true);
      }
      handleRequest(_err: any, user: any) {
        return user;
      }
    }
    return MockAuthGuard;
  },
}));

// Import after mock is in place
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: Reflector;
  let prisma: PrismaService;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    role: 'USER',
  };

  const createMockExecutionContext = (user?: any): ExecutionContext => {
    const request = { user };
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(request),
        getResponse: jest.fn(),
      }),
      getArgs: jest.fn(),
      getArgByIndex: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
      getType: jest.fn(),
    } as unknown as ExecutionContext;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtAuthGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn().mockReturnValue(false),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    guard = module.get<JwtAuthGuard>(JwtAuthGuard);
    reflector = module.get<Reflector>(Reflector);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    it('should allow public routes without JWT validation', async () => {
      (reflector.getAllAndOverride as jest.Mock).mockReturnValue(true);
      const context = createMockExecutionContext();

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
    });

    it('should allow non-banned user after JWT validation', async () => {
      const context = createMockExecutionContext(mockUser);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        isBanned: false,
        bannedUntil: null,
        banReason: null,
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        select: { isBanned: true, bannedUntil: true, banReason: true },
      });
    });

    it('should skip ban check when request has no user', async () => {
      const context = createMockExecutionContext(undefined);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException for banned user after JWT validation', async () => {
      const context = createMockExecutionContext(mockUser);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        isBanned: true,
        bannedUntil: null,
        banReason: 'Spam',
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('handleRequest', () => {
    it('should return user when valid', () => {
      const result = guard.handleRequest(null, mockUser);

      expect(result).toEqual(mockUser);
    });

    it('should throw the provided error when err is present', () => {
      const error = new Error('JWT expired');

      expect(() => guard.handleRequest(error, null)).toThrow('JWT expired');
    });

    it('should throw UnauthorizedException when user is null', () => {
      expect(() => guard.handleRequest(null, null)).toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when user is undefined', () => {
      expect(() => guard.handleRequest(null, undefined)).toThrow(
        UnauthorizedException,
      );
    });

    it('should throw err over UnauthorizedException when both err and no user', () => {
      const error = new Error('Custom error');

      expect(() => guard.handleRequest(error, null)).toThrow('Custom error');
    });
  });

  describe('checkBanStatus (via canActivate)', () => {
    it('should pass for a non-banned user', async () => {
      const context = createMockExecutionContext(mockUser);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        isBanned: false,
        bannedUntil: null,
        banReason: null,
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should auto-unban user with expired ban', async () => {
      const context = createMockExecutionContext(mockUser);
      const expiredDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // yesterday

      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        isBanned: true,
        bannedUntil: expiredDate,
        banReason: 'Temporary ban',
      });
      (prisma.user.update as jest.Mock).mockResolvedValue({});

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          isBanned: false,
          bannedAt: null,
          bannedUntil: null,
          banReason: null,
        },
      });
    });

    it('should throw ForbiddenException for active temporary ban', async () => {
      const context = createMockExecutionContext(mockUser);
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // next week

      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        isBanned: true,
        bannedUntil: futureDate,
        banReason: 'Violating rules',
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        /Account banned until/,
      );
    });

    it('should throw ForbiddenException for permanent ban (no bannedUntil)', async () => {
      const context = createMockExecutionContext(mockUser);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        isBanned: true,
        bannedUntil: null,
        banReason: 'Permanent violation',
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        /Account permanently banned/,
      );
    });

    it('should include ban reason in error message', async () => {
      const context = createMockExecutionContext(mockUser);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        isBanned: true,
        bannedUntil: null,
        banReason: 'Spamming the forum',
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        /Spamming the forum/,
      );
    });

    it('should show "No reason provided" when banReason is null', async () => {
      const context = createMockExecutionContext(mockUser);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        isBanned: true,
        bannedUntil: null,
        banReason: null,
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        /No reason provided/,
      );
    });

    it('should return when user not found in database', async () => {
      const context = createMockExecutionContext(mockUser);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });
  });
});
