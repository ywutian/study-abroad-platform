import { Test, TestingModule } from '@nestjs/testing';
import { McpApiKeyService } from './mcp-api-key.service';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('$2b$10$hashedKeyValue'),
  compare: jest.fn(),
}));

jest.mock('crypto', () => ({
  randomBytes: jest.fn().mockReturnValue({
    toString: jest
      .fn()
      .mockReturnValue(
        'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
      ),
  }),
}));

describe('McpApiKeyService', () => {
  let service: McpApiKeyService;
  let prismaService: PrismaService;

  const mockKeyRecord = {
    id: 'key-uuid-123',
    userId: 'user-123',
    keyHash: '$2b$10$hashedKeyValue',
    keyPrefix: 'mcp_a1b2c3d4',
    name: 'My API Key',
    isRevoked: false,
    expiresAt: null,
    lastUsedAt: null,
    createdAt: new Date('2026-01-01'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        McpApiKeyService,
        {
          provide: PrismaService,
          useValue: {
            mcpApiKey: {
              create: jest.fn(),
              findMany: jest.fn(),
              update: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<McpApiKeyService>(McpApiKeyService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateKey', () => {
    it('should create a new API key with mcp_ prefix', async () => {
      (prismaService.mcpApiKey.create as jest.Mock).mockResolvedValue(
        mockKeyRecord,
      );

      const result = await service.generateKey('user-123', 'My API Key');

      expect(result.key).toMatch(/^mcp_/);
      expect(result.keyId).toBe('key-uuid-123');
      expect(result.keyPrefix).toBe(result.key.slice(0, 12));
    });

    it('should store the bcrypt hash, not the plain key', async () => {
      (prismaService.mcpApiKey.create as jest.Mock).mockResolvedValue(
        mockKeyRecord,
      );

      await service.generateKey('user-123', 'Test Key');

      expect(bcrypt.hash).toHaveBeenCalledWith(
        expect.stringMatching(/^mcp_/),
        10, // BCRYPT_ROUNDS
      );
      expect(prismaService.mcpApiKey.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-123',
          keyHash: '$2b$10$hashedKeyValue',
          name: 'Test Key',
          expiresAt: null,
        }),
      });
    });

    it('should accept optional expiration date', async () => {
      const expiresAt = new Date('2027-01-01');
      (prismaService.mcpApiKey.create as jest.Mock).mockResolvedValue({
        ...mockKeyRecord,
        expiresAt,
      });

      await service.generateKey('user-123', 'Expiring Key', expiresAt);

      expect(prismaService.mcpApiKey.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          expiresAt,
        }),
      });
    });

    it('should set expiresAt to null when not provided', async () => {
      (prismaService.mcpApiKey.create as jest.Mock).mockResolvedValue(
        mockKeyRecord,
      );

      await service.generateKey('user-123', 'No Expiry');

      expect(prismaService.mcpApiKey.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          expiresAt: null,
        }),
      });
    });

    it('should propagate Prisma errors', async () => {
      (prismaService.mcpApiKey.create as jest.Mock).mockRejectedValue(
        new Error('Unique constraint violation'),
      );

      await expect(
        service.generateKey('user-123', 'Duplicate Key'),
      ).rejects.toThrow('Unique constraint violation');
    });

    it('should store keyPrefix as first 12 characters of the key', async () => {
      (prismaService.mcpApiKey.create as jest.Mock).mockResolvedValue(
        mockKeyRecord,
      );

      const result = await service.generateKey('user-123', 'Prefix Test');

      // keyPrefix should be "mcp_" + 8 hex chars = 12 chars
      expect(result.keyPrefix).toHaveLength(12);
      expect(result.keyPrefix).toMatch(/^mcp_[0-9a-f]{8}$/);
    });
  });

  describe('validateKey', () => {
    const mockCandidateWithUser = {
      ...mockKeyRecord,
      user: {
        id: 'user-123',
        role: 'USER',
        isBanned: false,
        deletedAt: null,
      },
    };

    it('should return key info for a valid key', async () => {
      (prismaService.mcpApiKey.findMany as jest.Mock).mockResolvedValue([
        mockCandidateWithUser,
      ]);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateKey('mcp_a1b2c3d4e5f6a1b2c3d4e5f6');

      expect(result).toEqual({
        keyId: 'key-uuid-123',
        userId: 'user-123',
        role: 'USER',
        name: 'My API Key',
      });
    });

    it('should use prefix-based lookup for efficiency', async () => {
      (prismaService.mcpApiKey.findMany as jest.Mock).mockResolvedValue([]);

      await service.validateKey('mcp_a1b2c3d4e5f6a1b2c3d4e5f6');

      expect(prismaService.mcpApiKey.findMany).toHaveBeenCalledWith({
        where: {
          keyPrefix: 'mcp_a1b2c3d4', // first 12 chars
          isRevoked: false,
        },
        include: {
          user: {
            select: { id: true, role: true, isBanned: true, deletedAt: true },
          },
        },
      });
    });

    it('should return null for key without mcp_ prefix', async () => {
      const result = await service.validateKey('invalid_prefix_key');

      expect(result).toBeNull();
      expect(prismaService.mcpApiKey.findMany).not.toHaveBeenCalled();
    });

    it('should return null for key that is too short', async () => {
      const result = await service.validateKey('mcp_short');

      expect(result).toBeNull();
      expect(prismaService.mcpApiKey.findMany).not.toHaveBeenCalled();
    });

    it('should return null when no matching prefix found', async () => {
      (prismaService.mcpApiKey.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.validateKey('mcp_zzzzzzzzzzzzzzzzzzzzzzzz');

      expect(result).toBeNull();
    });

    it('should return null when bcrypt comparison fails for all candidates', async () => {
      (prismaService.mcpApiKey.findMany as jest.Mock).mockResolvedValue([
        mockCandidateWithUser,
      ]);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await service.validateKey(
        'mcp_a1b2c3d4e5f6wrong_key_rest',
      );

      expect(result).toBeNull();
    });

    it('should skip expired keys', async () => {
      const expiredCandidate = {
        ...mockCandidateWithUser,
        expiresAt: new Date('2020-01-01'), // expired
      };
      (prismaService.mcpApiKey.findMany as jest.Mock).mockResolvedValue([
        expiredCandidate,
      ]);

      const result = await service.validateKey('mcp_a1b2c3d4e5f6a1b2c3d4e5f6');

      expect(result).toBeNull();
      // bcrypt.compare should not be called for expired keys
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('should accept non-expired keys', async () => {
      const futureCandidate = {
        ...mockCandidateWithUser,
        expiresAt: new Date('2099-01-01'), // far future
      };
      (prismaService.mcpApiKey.findMany as jest.Mock).mockResolvedValue([
        futureCandidate,
      ]);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateKey('mcp_a1b2c3d4e5f6a1b2c3d4e5f6');

      expect(result).not.toBeNull();
      expect(result?.userId).toBe('user-123');
    });

    it('should return null for a banned user', async () => {
      const bannedUserCandidate = {
        ...mockCandidateWithUser,
        user: { ...mockCandidateWithUser.user, isBanned: true },
      };
      (prismaService.mcpApiKey.findMany as jest.Mock).mockResolvedValue([
        bannedUserCandidate,
      ]);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateKey('mcp_a1b2c3d4e5f6a1b2c3d4e5f6');

      expect(result).toBeNull();
    });

    it('should return null for a soft-deleted user', async () => {
      const deletedUserCandidate = {
        ...mockCandidateWithUser,
        user: {
          ...mockCandidateWithUser.user,
          deletedAt: new Date('2026-01-15'),
        },
      };
      (prismaService.mcpApiKey.findMany as jest.Mock).mockResolvedValue([
        deletedUserCandidate,
      ]);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateKey('mcp_a1b2c3d4e5f6a1b2c3d4e5f6');

      expect(result).toBeNull();
    });

    it('should check multiple candidates and return the matching one', async () => {
      const candidate1 = {
        ...mockCandidateWithUser,
        id: 'key-1',
        name: 'Wrong Key',
      };
      const candidate2 = {
        ...mockCandidateWithUser,
        id: 'key-2',
        name: 'Correct Key',
      };

      (prismaService.mcpApiKey.findMany as jest.Mock).mockResolvedValue([
        candidate1,
        candidate2,
      ]);
      // First candidate fails, second matches
      (bcrypt.compare as jest.Mock)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      const result = await service.validateKey('mcp_a1b2c3d4e5f6a1b2c3d4e5f6');

      expect(result?.keyId).toBe('key-2');
      expect(result?.name).toBe('Correct Key');
      expect(bcrypt.compare).toHaveBeenCalledTimes(2);
    });

    it('should return null for empty string', async () => {
      const result = await service.validateKey('');

      expect(result).toBeNull();
    });
  });

  describe('validateKeyDetailed', () => {
    const mockCandidateWithUser = {
      ...mockKeyRecord,
      user: {
        id: 'user-123',
        role: 'USER',
        isBanned: false,
        deletedAt: null,
      },
    };

    it('should surface revoked keys distinctly', async () => {
      (prismaService.mcpApiKey.findMany as jest.Mock).mockResolvedValue([
        { ...mockCandidateWithUser, isRevoked: true },
      ]);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateKeyDetailed(
        'mcp_a1b2c3d4e5f6a1b2c3d4e5f6',
      );

      expect(result).toEqual({ status: 'revoked' });
    });

    it('should surface expired keys distinctly', async () => {
      (prismaService.mcpApiKey.findMany as jest.Mock).mockResolvedValue([
        {
          ...mockCandidateWithUser,
          expiresAt: new Date('2020-01-01'),
        },
      ]);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateKeyDetailed(
        'mcp_a1b2c3d4e5f6a1b2c3d4e5f6',
      );

      expect(result).toEqual({ status: 'expired' });
    });
  });

  describe('updateLastUsed', () => {
    it('should update lastUsedAt timestamp', async () => {
      (prismaService.mcpApiKey.update as jest.Mock).mockResolvedValue({
        ...mockKeyRecord,
        lastUsedAt: new Date(),
      });

      await service.updateLastUsed('key-uuid-123');

      expect(prismaService.mcpApiKey.update).toHaveBeenCalledWith({
        where: { id: 'key-uuid-123' },
        data: { lastUsedAt: expect.any(Date) },
      });
    });

    it('should not throw when update fails (fire-and-forget)', async () => {
      (prismaService.mcpApiKey.update as jest.Mock).mockRejectedValue(
        new Error('Record not found'),
      );

      // Should not throw due to internal .catch()
      await expect(
        service.updateLastUsed('nonexistent-key'),
      ).resolves.toBeUndefined();
    });
  });

  describe('revokeKey', () => {
    it('should set isRevoked to true', async () => {
      (prismaService.mcpApiKey.update as jest.Mock).mockResolvedValue({
        ...mockKeyRecord,
        isRevoked: true,
      });

      await service.revokeKey('key-uuid-123');

      expect(prismaService.mcpApiKey.update).toHaveBeenCalledWith({
        where: { id: 'key-uuid-123' },
        data: { isRevoked: true },
      });
    });

    it('should propagate errors when key does not exist', async () => {
      (prismaService.mcpApiKey.update as jest.Mock).mockRejectedValue(
        new Error('Record to update not found'),
      );

      await expect(service.revokeKey('nonexistent')).rejects.toThrow(
        'Record to update not found',
      );
    });
  });

  describe('listKeys', () => {
    const mockKeyList = [
      {
        id: 'key-1',
        userId: 'user-123',
        keyPrefix: 'mcp_aaaabbbb',
        name: 'Key 1',
        isRevoked: false,
        expiresAt: null,
        lastUsedAt: new Date('2026-03-01'),
        createdAt: new Date('2026-01-01'),
        user: { email: 'user@example.com' },
      },
      {
        id: 'key-2',
        userId: 'user-123',
        keyPrefix: 'mcp_ccccdddd',
        name: 'Key 2',
        isRevoked: true,
        expiresAt: new Date('2026-06-01'),
        lastUsedAt: null,
        createdAt: new Date('2026-02-01'),
        user: { email: 'user@example.com' },
      },
    ];

    it('should return all keys for a specific user', async () => {
      (prismaService.mcpApiKey.findMany as jest.Mock).mockResolvedValue(
        mockKeyList,
      );

      const result = await service.listKeys('user-123');

      expect(result).toHaveLength(2);
      expect(prismaService.mcpApiKey.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        select: {
          id: true,
          userId: true,
          keyPrefix: true,
          name: true,
          isRevoked: true,
          expiresAt: true,
          lastUsedAt: true,
          createdAt: true,
          user: { select: { email: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return all keys when no userId is provided', async () => {
      (prismaService.mcpApiKey.findMany as jest.Mock).mockResolvedValue(
        mockKeyList,
      );

      const result = await service.listKeys();

      expect(result).toHaveLength(2);
      expect(prismaService.mcpApiKey.findMany).toHaveBeenCalledWith({
        where: {},
        select: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return empty array when user has no keys', async () => {
      (prismaService.mcpApiKey.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.listKeys('user-no-keys');

      expect(result).toEqual([]);
    });

    it('should order results by createdAt descending', async () => {
      (prismaService.mcpApiKey.findMany as jest.Mock).mockResolvedValue(
        mockKeyList,
      );

      await service.listKeys('user-123');

      expect(prismaService.mcpApiKey.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('should not return keyHash in the select', async () => {
      (prismaService.mcpApiKey.findMany as jest.Mock).mockResolvedValue(
        mockKeyList,
      );

      await service.listKeys('user-123');

      const selectArg = (prismaService.mcpApiKey.findMany as jest.Mock).mock
        .calls[0][0].select;
      expect(selectArg).not.toHaveProperty('keyHash');
    });

    it('should include user email in the response', async () => {
      (prismaService.mcpApiKey.findMany as jest.Mock).mockResolvedValue(
        mockKeyList,
      );

      await service.listKeys('user-123');

      const selectArg = (prismaService.mcpApiKey.findMany as jest.Mock).mock
        .calls[0][0].select;
      expect(selectArg.user).toEqual({ select: { email: true } });
    });
  });
});
