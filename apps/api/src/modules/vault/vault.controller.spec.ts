import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { VaultController } from './vault.controller';
import { VaultService } from './vault.service';
import { UserService } from '../user/user.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('VaultController', () => {
  let controller: VaultController;
  let vaultService: VaultService;
  let userService: UserService;

  const mockUser = { id: 'user-1', email: 'test@test.com', role: 'USER' };

  const mockVaultItem = {
    id: 'vault-1',
    userId: 'user-1',
    name: 'Google',
    username: 'test@test.com',
    category: 'LOGIN',
  };

  const mockVaultDetail = {
    ...mockVaultItem,
    password: 'decrypted_password',
    notes: 'some notes',
  };

  const mockStats = {
    total: 10,
    byCategory: { LOGIN: 5, CARD: 3, NOTE: 2 },
    recentlyAdded: 3,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VaultController],
      providers: [
        {
          provide: VaultService,
          useValue: {
            create: jest.fn().mockResolvedValue(mockVaultItem),
            findAll: jest.fn().mockResolvedValue([mockVaultItem]),
            getStats: jest.fn().mockResolvedValue(mockStats),
            generatePassword: jest.fn().mockReturnValue('Str0ng!P@ssw0rd'),
            exportAll: jest.fn().mockResolvedValue([mockVaultDetail]),
            findOne: jest.fn().mockResolvedValue(mockVaultDetail),
            update: jest.fn().mockResolvedValue(mockVaultItem),
            delete: jest.fn().mockResolvedValue(undefined),
            deleteAll: jest.fn().mockResolvedValue({ count: 5 }),
            importItems: jest.fn().mockResolvedValue({ imported: 3 }),
          },
        },
        {
          provide: UserService,
          useValue: {
            findByIdOrThrow: jest.fn().mockResolvedValue({
              id: 'user-1',
              passwordHash: 'hashed_password',
            }),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<VaultController>(VaultController);
    vaultService = module.get<VaultService>(VaultService);
    userService = module.get<UserService>(UserService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a vault item', async () => {
      const dto = {
        name: 'Google',
        username: 'test@test.com',
        password: 'secret',
      };
      const result = await controller.create(mockUser as any, dto as any);

      expect(vaultService.create).toHaveBeenCalledWith('user-1', dto);
      expect(result).toEqual(mockVaultItem);
    });
  });

  describe('findAll', () => {
    it('should return all vault items for the user', async () => {
      const query = { category: 'LOGIN' };
      const result = await controller.findAll(mockUser as any, query as any);

      expect(vaultService.findAll).toHaveBeenCalledWith('user-1', query);
      expect(result).toEqual([mockVaultItem]);
    });
  });

  describe('getStats', () => {
    it('should return vault statistics', async () => {
      const result = await controller.getStats(mockUser as any);

      expect(vaultService.getStats).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(mockStats);
    });
  });

  describe('generatePassword', () => {
    it('should generate a password with default length', () => {
      const result = controller.generatePassword(undefined);

      expect(vaultService.generatePassword).toHaveBeenCalledWith(16);
      expect(result).toEqual({ password: 'Str0ng!P@ssw0rd' });
    });

    it('should clamp length between 8 and 64', () => {
      controller.generatePassword('4');
      expect(vaultService.generatePassword).toHaveBeenCalledWith(8);

      controller.generatePassword('100');
      expect(vaultService.generatePassword).toHaveBeenCalledWith(64);
    });
  });

  describe('exportAll', () => {
    it('should export all items after password verification', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await controller.exportAll(mockUser as any, {
        password: 'correct',
      });

      expect(userService.findByIdOrThrow).toHaveBeenCalledWith('user-1');
      expect(bcrypt.compare).toHaveBeenCalledWith('correct', 'hashed_password');
      expect(vaultService.exportAll).toHaveBeenCalledWith('user-1');
      expect(result).toEqual([mockVaultDetail]);
    });

    it('should throw UnauthorizedException on wrong password', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        controller.exportAll(mockUser as any, { password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);

      expect(vaultService.exportAll).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a single vault item with decrypted data', async () => {
      const result = await controller.findOne(mockUser as any, 'vault-1');

      expect(vaultService.findOne).toHaveBeenCalledWith('user-1', 'vault-1');
      expect(result).toEqual(mockVaultDetail);
    });
  });

  describe('update', () => {
    it('should update a vault item', async () => {
      const dto = { name: 'Updated Google' };
      const result = await controller.update(
        mockUser as any,
        'vault-1',
        dto as any,
      );

      expect(vaultService.update).toHaveBeenCalledWith(
        'user-1',
        'vault-1',
        dto,
      );
      expect(result).toEqual(mockVaultItem);
    });
  });

  describe('delete', () => {
    it('should delete a vault item and return success', async () => {
      const result = await controller.delete(mockUser as any, 'vault-1');

      expect(vaultService.delete).toHaveBeenCalledWith('user-1', 'vault-1');
      expect(result).toEqual({ success: true });
    });
  });

  describe('deleteAll', () => {
    it('should delete all vault items and return count', async () => {
      const result = await controller.deleteAll(mockUser as any);

      expect(vaultService.deleteAll).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({ count: 5 });
    });
  });

  describe('importItems', () => {
    it('should import vault items and return count', async () => {
      const items = [
        { name: 'Site A', username: 'user', password: 'pass' },
        { name: 'Site B', username: 'user', password: 'pass' },
      ];
      const result = await controller.importItems(
        mockUser as any,
        items as any,
      );

      expect(vaultService.importItems).toHaveBeenCalledWith('user-1', items);
      expect(result).toEqual({ imported: 3 });
    });
  });
});
