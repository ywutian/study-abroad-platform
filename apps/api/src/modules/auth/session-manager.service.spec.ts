import { Test, TestingModule } from '@nestjs/testing';
import { SessionManager } from './session-manager.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('SessionManager', () => {
  let service: SessionManager;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionManager,
        {
          provide: PrismaService,
          useValue: {
            refreshToken: {
              deleteMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<SessionManager>(SessionManager);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('invalidateAllSessions', () => {
    it('should delete all refresh tokens for the given user', async () => {
      (prismaService.refreshToken.deleteMany as jest.Mock).mockResolvedValue({
        count: 3,
      });

      const count = await service.invalidateAllSessions('user-123');

      expect(count).toBe(3);
      expect(prismaService.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
      });
    });

    it('should return 0 when user has no active sessions', async () => {
      (prismaService.refreshToken.deleteMany as jest.Mock).mockResolvedValue({
        count: 0,
      });

      const count = await service.invalidateAllSessions('user-no-sessions');

      expect(count).toBe(0);
    });

    it('should handle single session deletion', async () => {
      (prismaService.refreshToken.deleteMany as jest.Mock).mockResolvedValue({
        count: 1,
      });

      const count = await service.invalidateAllSessions('user-single');

      expect(count).toBe(1);
    });

    it('should propagate Prisma errors', async () => {
      (prismaService.refreshToken.deleteMany as jest.Mock).mockRejectedValue(
        new Error('Database connection error'),
      );

      await expect(service.invalidateAllSessions('user-123')).rejects.toThrow(
        'Database connection error',
      );
    });

    it('should handle high session count', async () => {
      (prismaService.refreshToken.deleteMany as jest.Mock).mockResolvedValue({
        count: 50,
      });

      const count = await service.invalidateAllSessions('user-many');

      expect(count).toBe(50);
    });
  });

  describe('invalidateToken', () => {
    it('should return true when token is found and deleted', async () => {
      (prismaService.refreshToken.deleteMany as jest.Mock).mockResolvedValue({
        count: 1,
      });

      const result = await service.invalidateToken('valid_refresh_token');

      expect(result).toBe(true);
      expect(prismaService.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { token: 'valid_refresh_token' },
      });
    });

    it('should return false when token does not exist', async () => {
      (prismaService.refreshToken.deleteMany as jest.Mock).mockResolvedValue({
        count: 0,
      });

      const result = await service.invalidateToken('nonexistent_token');

      expect(result).toBe(false);
    });

    it('should propagate Prisma errors', async () => {
      (prismaService.refreshToken.deleteMany as jest.Mock).mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.invalidateToken('some_token')).rejects.toThrow(
        'Database error',
      );
    });

    it('should handle empty string token', async () => {
      (prismaService.refreshToken.deleteMany as jest.Mock).mockResolvedValue({
        count: 0,
      });

      const result = await service.invalidateToken('');

      expect(result).toBe(false);
      expect(prismaService.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { token: '' },
      });
    });
  });

  describe('integration-like scenarios', () => {
    it('should work correctly when invalidateAllSessions is called after invalidateToken', async () => {
      // First invalidate a specific token
      (
        prismaService.refreshToken.deleteMany as jest.Mock
      ).mockResolvedValueOnce({ count: 1 });
      const tokenResult = await service.invalidateToken('specific_token');
      expect(tokenResult).toBe(true);

      // Then invalidate all remaining sessions
      (
        prismaService.refreshToken.deleteMany as jest.Mock
      ).mockResolvedValueOnce({ count: 2 });
      const allResult = await service.invalidateAllSessions('user-123');
      expect(allResult).toBe(2);

      expect(prismaService.refreshToken.deleteMany).toHaveBeenCalledTimes(2);
    });

    it('should handle concurrent invalidation calls', async () => {
      (prismaService.refreshToken.deleteMany as jest.Mock)
        .mockResolvedValueOnce({ count: 3 })
        .mockResolvedValueOnce({ count: 0 });

      const [first, second] = await Promise.all([
        service.invalidateAllSessions('user-123'),
        service.invalidateAllSessions('user-123'),
      ]);

      // First call deletes 3, second finds none left
      expect(first).toBe(3);
      expect(second).toBe(0);
    });
  });
});
