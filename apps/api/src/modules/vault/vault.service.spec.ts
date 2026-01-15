import { Test, TestingModule } from '@nestjs/testing';
import { VaultService } from './vault.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthorizationService } from '../../common/services/authorization.service';
import { EncryptionService } from './encryption.service';
import { VaultItemType } from '../../common/types/enums';

describe('VaultService', () => {
  let service: VaultService;
  let prismaService: PrismaService;
  let authService: AuthorizationService;
  let encryptionService: EncryptionService;

  const mockUserId = 'user-123';
  const mockItemId = 'item-123';

  const mockVaultItem = {
    id: mockItemId,
    userId: mockUserId,
    type: VaultItemType.CREDENTIAL,
    title: 'Test Credential',
    encryptedData: 'encrypted-data',
    iv: 'test-iv',
    category: 'Accounts',
    tags: ['important'],
    icon: '🔐',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VaultService,
        {
          provide: PrismaService,
          useValue: {
            vaultItem: {
              findMany: jest.fn(),
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
              deleteMany: jest.fn(),
              groupBy: jest.fn(),
            },
          },
        },
        {
          provide: AuthorizationService,
          useValue: {
            verifyOwnership: jest.fn(),
          },
        },
        {
          provide: EncryptionService,
          useValue: {
            encrypt: jest
              .fn()
              .mockReturnValue({ encryptedData: 'encrypted', iv: 'iv-123' }),
            decrypt: jest.fn().mockReturnValue('decrypted-data'),
            generatePassword: jest.fn().mockReturnValue('generated-password'),
          },
        },
      ],
    }).compile();

    service = module.get<VaultService>(VaultService);
    prismaService = module.get<PrismaService>(PrismaService);
    authService = module.get<AuthorizationService>(AuthorizationService);
    encryptionService = module.get<EncryptionService>(EncryptionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================
  // CRUD Operations
  // ============================================

  describe('create', () => {
    it('should create and encrypt vault item', async () => {
      (prismaService.vaultItem.create as jest.Mock).mockResolvedValue(
        mockVaultItem,
      );

      const result = await service.create(mockUserId, {
        type: VaultItemType.CREDENTIAL,
        title: 'Test Credential',
        data: 'sensitive-data',
        category: 'Accounts',
        tags: ['important'],
      });

      expect(encryptionService.encrypt).toHaveBeenCalledWith(
        'sensitive-data',
        mockUserId,
      );
      expect(result.id).toBe(mockItemId);
      expect(result.title).toBe('Test Credential');
    });
  });

  describe('findAll', () => {
    it('should return all vault items for user', async () => {
      (prismaService.vaultItem.findMany as jest.Mock).mockResolvedValue([
        mockVaultItem,
      ]);

      const result = await service.findAll(mockUserId, {});

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Test Credential');
      expect(prismaService.vaultItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: mockUserId },
        }),
      );
    });

    it('should filter by type', async () => {
      (prismaService.vaultItem.findMany as jest.Mock).mockResolvedValue([]);

      await service.findAll(mockUserId, { type: VaultItemType.CREDENTIAL });

      expect(prismaService.vaultItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: mockUserId, type: VaultItemType.CREDENTIAL },
        }),
      );
    });

    it('should filter by category', async () => {
      (prismaService.vaultItem.findMany as jest.Mock).mockResolvedValue([]);

      await service.findAll(mockUserId, { category: 'Accounts' });

      expect(prismaService.vaultItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: mockUserId, category: 'Accounts' },
        }),
      );
    });

    it('should filter by search term', async () => {
      (prismaService.vaultItem.findMany as jest.Mock).mockResolvedValue([]);

      await service.findAll(mockUserId, { search: 'test' });

      expect(prismaService.vaultItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: mockUserId,
            OR: expect.any(Array),
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return decrypted vault item', async () => {
      (prismaService.vaultItem.findUnique as jest.Mock).mockResolvedValue(
        mockVaultItem,
      );
      (authService.verifyOwnership as jest.Mock).mockReturnValue(mockVaultItem);

      const result = await service.findOne(mockUserId, mockItemId);

      expect(authService.verifyOwnership).toHaveBeenCalled();
      expect(encryptionService.decrypt).toHaveBeenCalledWith(
        mockVaultItem.encryptedData,
        mockVaultItem.iv,
        mockUserId,
      );
      expect(result.data).toBe('decrypted-data');
    });
  });

  describe('update', () => {
    it('should update vault item', async () => {
      (prismaService.vaultItem.findUnique as jest.Mock).mockResolvedValue(
        mockVaultItem,
      );
      (authService.verifyOwnership as jest.Mock).mockReturnValue(mockVaultItem);
      (prismaService.vaultItem.update as jest.Mock).mockResolvedValue({
        ...mockVaultItem,
        title: 'Updated Title',
      });

      const result = await service.update(mockUserId, mockItemId, {
        title: 'Updated Title',
      });

      expect(authService.verifyOwnership).toHaveBeenCalled();
      expect(result.title).toBe('Updated Title');
    });

    it('should re-encrypt when data is updated', async () => {
      (prismaService.vaultItem.findUnique as jest.Mock).mockResolvedValue(
        mockVaultItem,
      );
      (authService.verifyOwnership as jest.Mock).mockReturnValue(mockVaultItem);
      (prismaService.vaultItem.update as jest.Mock).mockResolvedValue(
        mockVaultItem,
      );

      await service.update(mockUserId, mockItemId, {
        data: 'new-sensitive-data',
      });

      expect(encryptionService.encrypt).toHaveBeenCalledWith(
        'new-sensitive-data',
        mockUserId,
      );
    });
  });

  describe('delete', () => {
    it('should delete vault item', async () => {
      (prismaService.vaultItem.findUnique as jest.Mock).mockResolvedValue(
        mockVaultItem,
      );
      (authService.verifyOwnership as jest.Mock).mockReturnValue(mockVaultItem);
      (prismaService.vaultItem.delete as jest.Mock).mockResolvedValue(
        mockVaultItem,
      );

      await service.delete(mockUserId, mockItemId);

      expect(authService.verifyOwnership).toHaveBeenCalled();
      expect(prismaService.vaultItem.delete).toHaveBeenCalledWith({
        where: { id: mockItemId },
      });
    });
  });

  // ============================================
  // Statistics
  // ============================================

  describe('getStats', () => {
    it('should return vault statistics', async () => {
      (prismaService.vaultItem.groupBy as jest.Mock).mockResolvedValue([
        { type: VaultItemType.CREDENTIAL, _count: 5 },
        { type: VaultItemType.DOCUMENT, _count: 3 },
      ]);
      (prismaService.vaultItem.findMany as jest.Mock).mockResolvedValue([
        { category: 'Accounts' },
        { category: 'Work' },
      ]);

      const result = await service.getStats(mockUserId);

      expect(result.totalItems).toBe(8);
      expect(result.credentialCount).toBe(5);
      expect(result.documentCount).toBe(3);
      expect(result.categories).toContain('Accounts');
    });
  });

  // ============================================
  // Bulk Operations
  // ============================================

  describe('deleteAll', () => {
    it('should delete all vault items for user', async () => {
      (prismaService.vaultItem.deleteMany as jest.Mock).mockResolvedValue({
        count: 10,
      });

      const result = await service.deleteAll(mockUserId);

      expect(result.count).toBe(10);
      expect(prismaService.vaultItem.deleteMany).toHaveBeenCalledWith({
        where: { userId: mockUserId },
      });
    });
  });

  describe('exportAll', () => {
    it('should export all items with decrypted data', async () => {
      (prismaService.vaultItem.findMany as jest.Mock).mockResolvedValue([
        mockVaultItem,
      ]);

      const result = await service.exportAll(mockUserId);

      expect(result).toHaveLength(1);
      expect(result[0].data).toBe('decrypted-data');
    });
  });

  describe('importItems', () => {
    it('should import and encrypt items', async () => {
      (prismaService.vaultItem.create as jest.Mock).mockResolvedValue(
        mockVaultItem,
      );

      const result = await service.importItems(mockUserId, [
        { type: 'CREDENTIAL', title: 'Item 1', data: 'data1' },
        { type: 'DOCUMENT', title: 'Item 2', data: 'data2' },
      ]);

      expect(result.imported).toBe(2);
      expect(encryptionService.encrypt).toHaveBeenCalledTimes(2);
    });

    it('should skip items with invalid type', async () => {
      (prismaService.vaultItem.create as jest.Mock).mockResolvedValue(
        mockVaultItem,
      );

      const result = await service.importItems(mockUserId, [
        { type: 'INVALID_TYPE', title: 'Item 1', data: 'data1' },
        { type: 'CREDENTIAL', title: 'Item 2', data: 'data2' },
      ]);

      expect(result.imported).toBe(1);
    });
  });

  // ============================================
  // Utilities
  // ============================================

  describe('generatePassword', () => {
    it('should generate password with default length', () => {
      const result = service.generatePassword();

      expect(encryptionService.generatePassword).toHaveBeenCalledWith(16);
      expect(result).toBe('generated-password');
    });

    it('should generate password with custom length', () => {
      service.generatePassword(24);

      expect(encryptionService.generatePassword).toHaveBeenCalledWith(24);
    });
  });
});
