import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminOperatorService } from './admin-operator.service';

describe('AdminOperatorService', () => {
  let service: AdminOperatorService;

  const mockPrisma = {
    operatorInvite: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    auditLog: {
      count: jest.fn(),
    },
    $transaction: jest.fn((ops: any[]) => Promise.resolve(ops)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminOperatorService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AdminOperatorService>(AdminOperatorService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createInvite', () => {
    it('should create an invite with token', async () => {
      mockPrisma.operatorInvite.create.mockResolvedValue({
        id: 'inv-1',
        token: 'abc123',
        email: 'test@test.com',
        role: 'OPERATOR',
        expiresAt: new Date(),
      });

      const result = await service.createInvite('admin-1', 'test@test.com');

      expect(result.token).toBeDefined();
      expect(result.role).toBe('OPERATOR');
      expect(mockPrisma.operatorInvite.create).toHaveBeenCalled();
    });
  });

  describe('consumeInvite', () => {
    it('should throw NotFoundException for invalid token', async () => {
      mockPrisma.operatorInvite.findUnique.mockResolvedValue(null);

      await expect(
        service.consumeInvite('invalid-token', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for used invite', async () => {
      mockPrisma.operatorInvite.findUnique.mockResolvedValue({
        id: 'inv-1',
        token: 'abc',
        usedBy: 'user-2',
        expiresAt: new Date(Date.now() + 86400000),
      });

      await expect(service.consumeInvite('abc', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for expired invite', async () => {
      mockPrisma.operatorInvite.findUnique.mockResolvedValue({
        id: 'inv-1',
        token: 'abc',
        usedBy: null,
        expiresAt: new Date(Date.now() - 86400000),
      });

      await expect(service.consumeInvite('abc', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('listInvites', () => {
    it('should return invites with status', async () => {
      const now = new Date();
      mockPrisma.operatorInvite.findMany.mockResolvedValue([
        { id: 'i1', usedBy: 'u1', expiresAt: now },
        { id: 'i2', usedBy: null, expiresAt: new Date(Date.now() - 1000) },
        { id: 'i3', usedBy: null, expiresAt: new Date(Date.now() + 86400000) },
      ]);

      const result = await service.listInvites();

      expect(result[0].status).toBe('ACCEPTED');
      expect(result[1].status).toBe('EXPIRED');
      expect(result[2].status).toBe('PENDING');
    });
  });

  describe('getOperatorStats', () => {
    it('should throw NotFoundException for non-operator user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        role: 'USER',
      });

      await expect(service.getOperatorStats('u1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return stats for valid operator', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'op-1',
        role: 'OPERATOR',
      });
      mockPrisma.auditLog.count.mockResolvedValue(5);

      const result = await service.getOperatorStats('op-1');

      expect(result.casesCreated).toBeDefined();
      expect(result.reviews).toBeDefined();
    });
  });
});
