import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { ReportStatus, Role } from '@prisma/client';

describe('AdminService', () => {
  let service: AdminService;
  let prisma: PrismaService;

  const mockAdminId = 'admin-001';
  const mockUserId = 'user-001';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
              count: jest.fn(),
              update: jest.fn(),
            },
            report: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
              count: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
            admissionCase: {
              count: jest.fn(),
            },
            review: {
              count: jest.fn(),
            },
            auditLog: {
              create: jest.fn(),
              findMany: jest.fn(),
              count: jest.fn(),
            },
            schoolDeadline: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
              count: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
            school: {
              findUnique: jest.fn(),
            },
            globalEvent: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
              count: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================
  // getStats
  // ============================================

  describe('getStats', () => {
    it('should return correct stats', async () => {
      (prisma.user.count as jest.Mock)
        .mockResolvedValueOnce(100) // totalUsers
        .mockResolvedValueOnce(50); // verifiedUsers
      (prisma.admissionCase.count as jest.Mock).mockResolvedValue(30);
      (prisma.report.count as jest.Mock).mockResolvedValue(5);
      (prisma.review.count as jest.Mock).mockResolvedValue(200);

      const result = await service.getStats();

      expect(result).toEqual({
        totalUsers: 100,
        verifiedUsers: 50,
        totalCases: 30,
        pendingReports: 5,
        totalReviews: 200,
      });
    });
  });

  // ============================================
  // Reports
  // ============================================

  describe('getReports', () => {
    it('should return paginated reports', async () => {
      const mockReports = [{ id: 'r1', status: 'PENDING' }];
      (prisma.report.findMany as jest.Mock).mockResolvedValue(mockReports);
      (prisma.report.count as jest.Mock).mockResolvedValue(1);

      const result = await service.getReports(
        ReportStatus.PENDING,
        undefined,
        1,
        20,
      );

      expect(result.data).toEqual(mockReports);
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
    });
  });

  describe('updateReportStatus', () => {
    it('should update report and create audit log', async () => {
      const mockReport = {
        id: 'r1',
        status: 'PENDING',
        targetType: 'USER',
        targetId: 'u1',
      };
      (prisma.report.findUnique as jest.Mock).mockResolvedValue(mockReport);
      (prisma.report.update as jest.Mock).mockResolvedValue({
        ...mockReport,
        status: 'RESOLVED',
      });
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.updateReportStatus(
        mockAdminId,
        'r1',
        ReportStatus.RESOLVED,
        'Fixed',
      );

      expect(result.status).toBe('RESOLVED');
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException if report not found', async () => {
      (prisma.report.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.updateReportStatus(
          mockAdminId,
          'nonexistent',
          ReportStatus.RESOLVED,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteReport', () => {
    it('should delete report and create audit log', async () => {
      const mockReport = {
        id: 'r1',
        targetType: 'USER',
        targetId: 'u1',
        reason: 'spam',
      };
      (prisma.report.findUnique as jest.Mock).mockResolvedValue(mockReport);
      (prisma.report.delete as jest.Mock).mockResolvedValue(mockReport);
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({});

      await service.deleteReport(mockAdminId, 'r1');

      expect(prisma.report.delete).toHaveBeenCalledWith({
        where: { id: 'r1' },
      });
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException if report not found', async () => {
      (prisma.report.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.deleteReport(mockAdminId, 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ============================================
  // Users
  // ============================================

  describe('getUsers', () => {
    it('should return paginated users', async () => {
      const mockUsers = [{ id: 'u1', email: 'test@test.com' }];
      (prisma.user.findMany as jest.Mock).mockResolvedValue(mockUsers);
      (prisma.user.count as jest.Mock).mockResolvedValue(1);

      const result = await service.getUsers(undefined, undefined, 1, 20);

      expect(result.data).toEqual(mockUsers);
      expect(result.total).toBe(1);
    });

    it('should filter by search and role', async () => {
      (prisma.user.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.user.count as jest.Mock).mockResolvedValue(0);

      await service.getUsers('test@', Role.ADMIN, 1, 20);

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            email: { contains: 'test@', mode: 'insensitive' },
            role: Role.ADMIN,
          }),
        }),
      );
    });
  });

  describe('updateUserRole', () => {
    it('should update role and create audit log', async () => {
      const mockUser = { id: mockUserId, email: 'test@test.com', role: 'USER' };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.user.update as jest.Mock).mockResolvedValue({
        ...mockUser,
        role: 'VERIFIED',
      });
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.updateUserRole(
        mockAdminId,
        mockUserId,
        Role.VERIFIED,
      );

      expect(result.role).toBe('VERIFIED');
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });

    it('should throw ForbiddenException when modifying own role', async () => {
      await expect(
        service.updateUserRole(mockAdminId, mockAdminId, Role.USER),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if user not found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.updateUserRole(mockAdminId, 'nonexistent', Role.VERIFIED),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteUser', () => {
    it('should soft delete user and create audit log', async () => {
      const mockUser = { id: mockUserId, email: 'test@test.com', role: 'USER' };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.user.update as jest.Mock).mockResolvedValue({
        ...mockUser,
        deletedAt: new Date(),
      });
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({});

      await service.deleteUser(mockAdminId, mockUserId);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockUserId },
          data: { deletedAt: expect.any(Date) },
        }),
      );
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });

    it('should throw ForbiddenException when deleting own account', async () => {
      await expect(
        service.deleteUser(mockAdminId, mockAdminId),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if user not found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.deleteUser(mockAdminId, 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ============================================
  // Audit Logs
  // ============================================

  describe('getAuditLogs', () => {
    it('should return paginated audit logs', async () => {
      const mockLogs = [{ id: 'log1', action: 'UPDATE_USER_ROLE' }];
      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue(mockLogs);
      (prisma.auditLog.count as jest.Mock).mockResolvedValue(1);

      const result = await service.getAuditLogs(1, 50);

      expect(result.data).toEqual(mockLogs);
      expect(result.total).toBe(1);
    });

    it('should filter by action and resource', async () => {
      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.auditLog.count as jest.Mock).mockResolvedValue(0);

      await service.getAuditLogs(1, 50, {
        action: 'DELETE_USER',
        resource: 'user',
      });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            action: 'DELETE_USER',
            resource: 'user',
          }),
        }),
      );
    });
  });

  // ============================================
  // School Deadlines
  // ============================================

  describe('createSchoolDeadline', () => {
    it('should create a deadline', async () => {
      (prisma.school.findUnique as jest.Mock).mockResolvedValue({ id: 's1' });
      (prisma.schoolDeadline.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.schoolDeadline.create as jest.Mock).mockResolvedValue({
        id: 'd1',
      });

      const result = await service.createSchoolDeadline({
        schoolId: 's1',
        year: 2026,
        round: 'RD',
        applicationDeadline: '2026-01-01',
      } as any);

      expect(result).toEqual({ id: 'd1' });
    });

    it('should throw NotFoundException if school not found', async () => {
      (prisma.school.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.createSchoolDeadline({
          schoolId: 'nonexistent',
          year: 2026,
          round: 'RD',
          applicationDeadline: '2026-01-01',
        } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteSchoolDeadline', () => {
    it('should delete a deadline', async () => {
      (prisma.schoolDeadline.findUnique as jest.Mock).mockResolvedValue({
        id: 'd1',
      });
      (prisma.schoolDeadline.delete as jest.Mock).mockResolvedValue({
        id: 'd1',
      });

      await service.deleteSchoolDeadline('d1');

      expect(prisma.schoolDeadline.delete).toHaveBeenCalledWith({
        where: { id: 'd1' },
      });
    });

    it('should throw NotFoundException if deadline not found', async () => {
      (prisma.schoolDeadline.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.deleteSchoolDeadline('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ============================================
  // Global Events
  // ============================================

  describe('createGlobalEvent', () => {
    it('should create an event', async () => {
      (prisma.globalEvent.create as jest.Mock).mockResolvedValue({
        id: 'e1',
        title: 'SAT',
      });

      const result = await service.createGlobalEvent({
        title: 'SAT',
        category: 'TEST' as any,
        eventDate: '2026-03-01',
        year: 2026,
      } as any);

      expect(result.title).toBe('SAT');
    });
  });

  describe('deleteGlobalEvent', () => {
    it('should delete an event', async () => {
      (prisma.globalEvent.findUnique as jest.Mock).mockResolvedValue({
        id: 'e1',
      });
      (prisma.globalEvent.delete as jest.Mock).mockResolvedValue({ id: 'e1' });

      await service.deleteGlobalEvent('e1');

      expect(prisma.globalEvent.delete).toHaveBeenCalledWith({
        where: { id: 'e1' },
      });
    });

    it('should throw NotFoundException if event not found', async () => {
      (prisma.globalEvent.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.deleteGlobalEvent('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
