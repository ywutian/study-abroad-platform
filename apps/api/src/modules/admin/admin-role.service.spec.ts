import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { RedisService } from '../../common/redis/redis.service';
import { AuditLogService } from '../../common/services/audit-log.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminRoleService } from './admin-role.service';

describe('AdminRoleService', () => {
  let service: AdminRoleService;

  const mockPrisma: any = {
    rolePermission: {
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    userPermission: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    auditLog: {
      count: jest.fn(),
    },
    $transaction: jest.fn((cb: any) =>
      typeof cb === 'function' ? cb(mockPrisma) : Promise.resolve(cb),
    ),
  };

  const mockRedis = {
    del: jest.fn().mockResolvedValue(1),
  };

  const mockAuditLog = {
    log: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminRoleService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
        { provide: AuditLogService, useValue: mockAuditLog },
      ],
    }).compile();

    service = module.get<AdminRoleService>(AdminRoleService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('setUserRole', () => {
    it('should throw ForbiddenException on self-modification', async () => {
      await expect(
        service.setUserRole('admin-1', Role.USER, 'admin-1', Role.ADMIN),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException on role escalation', async () => {
      await expect(
        service.setUserRole('user-1', Role.ADMIN, 'op-1', Role.OPERATOR),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.setUserRole(
          'nonexistent',
          Role.VERIFIED,
          'admin-1',
          Role.ADMIN,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update role and invalidate cache', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@test.com',
        role: Role.USER,
      });
      mockPrisma.user.update.mockResolvedValue({
        id: 'user-1',
        email: 'test@test.com',
        role: Role.VERIFIED,
      });

      const result = await service.setUserRole(
        'user-1',
        Role.VERIFIED,
        'admin-1',
        Role.ADMIN,
      );

      expect(result.role).toBe(Role.VERIFIED);
      expect(mockRedis.del).toHaveBeenCalled();
      expect(mockAuditLog.log).toHaveBeenCalled();
    });
  });

  describe('findUserByEmail', () => {
    it('should return user when found', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'u1',
        email: 'test@test.com',
        role: Role.USER,
      });

      const result = await service.findUserByEmail('test@test.com');

      expect(result.email).toBe('test@test.com');
    });

    it('should throw NotFoundException when not found', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.findUserByEmail('nonexistent@test.com'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('promoteUserByEmail', () => {
    it('should throw BadRequestException when user already has role', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'u1',
        email: 'test@test.com',
        role: Role.VERIFIED,
      });

      await expect(
        service.promoteUserByEmail(
          'test@test.com',
          Role.VERIFIED,
          'admin-1',
          Role.ADMIN,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
