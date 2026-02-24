import { Test, TestingModule } from '@nestjs/testing';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { NotificationService } from '../notification/notification.service';
import { PrismaService } from '../../prisma/prisma.service';
import { Role, GlobalEventCategory } from '@prisma/client';

describe('AdminController', () => {
  let controller: AdminController;
  let adminService: jest.Mocked<AdminService>;

  const mockAdmin = {
    id: 'admin-1',
    email: 'admin@test.com',
    role: 'ADMIN',
    locale: 'zh',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        {
          provide: NotificationService,
          useValue: {
            createNotification: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUniqueOrThrow: jest.fn(),
              findMany: jest.fn().mockResolvedValue([]),
            },
            payment: { findMany: jest.fn().mockResolvedValue([]) },
            auditLog: { findMany: jest.fn().mockResolvedValue([]) },
          },
        },
        {
          provide: AdminService,
          useValue: {
            getStats: jest.fn().mockResolvedValue({ users: 100, reports: 5 }),
            getTrends: jest
              .fn()
              .mockResolvedValue([{ date: '2025-01-01', count: 10 }]),
            getReports: jest.fn().mockResolvedValue({ data: [], total: 0 }),
            updateReportStatus: jest
              .fn()
              .mockResolvedValue({ id: 'report-1', status: 'RESOLVED' }),
            deleteReport: jest.fn().mockResolvedValue(undefined),
            getUsers: jest.fn().mockResolvedValue({ data: [], total: 0 }),
            updateUserRole: jest
              .fn()
              .mockResolvedValue({ id: 'user-1', role: Role.ADMIN }),
            banUser: jest
              .fn()
              .mockResolvedValue({ id: 'user-1', banned: true }),
            unbanUser: jest
              .fn()
              .mockResolvedValue({ id: 'user-1', banned: false }),
            deleteUser: jest.fn().mockResolvedValue(undefined),
            getAuditLogs: jest.fn().mockResolvedValue({ data: [], total: 0 }),
            getSchoolDeadlines: jest
              .fn()
              .mockResolvedValue({ data: [], total: 0 }),
            createSchoolDeadline: jest
              .fn()
              .mockResolvedValue({ id: 'deadline-1' }),
            updateSchoolDeadline: jest
              .fn()
              .mockResolvedValue({ id: 'deadline-1' }),
            deleteSchoolDeadline: jest.fn().mockResolvedValue(undefined),
            getGlobalEvents: jest
              .fn()
              .mockResolvedValue({ data: [], total: 0 }),
            createGlobalEvent: jest.fn().mockResolvedValue({ id: 'event-1' }),
            updateGlobalEvent: jest.fn().mockResolvedValue({ id: 'event-1' }),
            deleteGlobalEvent: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    controller = module.get<AdminController>(AdminController);
    adminService = module.get(AdminService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ========== Stats ==========

  describe('getStats', () => {
    it('should return stats from adminService', async () => {
      const result = await controller.getStats();

      expect(adminService.getStats).toHaveBeenCalled();
      expect(result).toEqual({ users: 100, reports: 5 });
    });
  });

  describe('getTrends', () => {
    it('should return trends from adminService', async () => {
      const result = await controller.getTrends();

      expect(adminService.getTrends).toHaveBeenCalled();
      expect(result).toEqual([{ date: '2025-01-01', count: 10 }]);
    });
  });

  // ========== Reports ==========

  describe('getReports', () => {
    it('should pass query params to adminService.getReports', async () => {
      const query = {
        status: 'PENDING' as any,
        targetType: 'POST' as any,
        page: 2,
        pageSize: 10,
      };
      await controller.getReports(query);

      expect(adminService.getReports).toHaveBeenCalledWith(
        'PENDING',
        'POST',
        2,
        10,
      );
    });

    it('should default page=1 and pageSize=20', async () => {
      await controller.getReports({} as any);

      expect(adminService.getReports).toHaveBeenCalledWith(
        undefined,
        undefined,
        1,
        20,
      );
    });
  });

  describe('updateReport', () => {
    it('should call updateReportStatus with admin id, report id, status and resolution', async () => {
      const dto = { status: 'RESOLVED' as any, resolution: 'Spam removed' };
      const result = await controller.updateReport(
        mockAdmin as any,
        'report-1',
        dto,
      );

      expect(adminService.updateReportStatus).toHaveBeenCalledWith(
        'admin-1',
        'report-1',
        'RESOLVED',
        'Spam removed',
      );
      expect(result).toEqual({ id: 'report-1', status: 'RESOLVED' });
    });
  });

  describe('deleteReport', () => {
    it('should delete report and return confirmation message', async () => {
      const result = await controller.deleteReport(
        mockAdmin as any,
        'report-1',
      );

      expect(adminService.deleteReport).toHaveBeenCalledWith(
        'admin-1',
        'report-1',
      );
      expect(result).toEqual({ message: 'Report deleted' });
    });
  });

  // ========== Users ==========

  describe('getUsers', () => {
    it('should pass query params to adminService.getUsers', async () => {
      const query = { search: 'john', role: Role.USER, page: 3, pageSize: 15 };
      await controller.getUsers(query);

      expect(adminService.getUsers).toHaveBeenCalledWith(
        'john',
        Role.USER,
        3,
        15,
      );
    });

    it('should default page=1 and pageSize=20', async () => {
      await controller.getUsers({} as any);

      expect(adminService.getUsers).toHaveBeenCalledWith(
        undefined,
        undefined,
        1,
        20,
      );
    });
  });

  describe('updateUserRole', () => {
    it('should call updateUserRole with admin id, user id and role', async () => {
      const result = await controller.updateUserRole(
        mockAdmin as any,
        'user-1',
        { role: Role.ADMIN },
      );

      expect(adminService.updateUserRole).toHaveBeenCalledWith(
        'admin-1',
        'user-1',
        Role.ADMIN,
      );
      expect(result).toEqual({ id: 'user-1', role: Role.ADMIN });
    });
  });

  describe('banUser', () => {
    it('should call banUser with admin id, user id, reason, duration and permanent', async () => {
      const dto = { reason: 'Spamming', durationHours: 24, permanent: false };
      const result = await controller.banUser(
        mockAdmin as any,
        'user-1',
        dto as any,
      );

      expect(adminService.banUser).toHaveBeenCalledWith(
        'admin-1',
        'user-1',
        'Spamming',
        24,
        false,
      );
      expect(result).toEqual({ id: 'user-1', banned: true });
    });
  });

  describe('unbanUser', () => {
    it('should call unbanUser with admin id and user id', async () => {
      const result = await controller.unbanUser(mockAdmin as any, 'user-1');

      expect(adminService.unbanUser).toHaveBeenCalledWith('admin-1', 'user-1');
      expect(result).toEqual({ id: 'user-1', banned: false });
    });
  });

  describe('deleteUser', () => {
    it('should delete user and return confirmation message', async () => {
      const result = await controller.deleteUser(mockAdmin as any, 'user-1');

      expect(adminService.deleteUser).toHaveBeenCalledWith('admin-1', 'user-1');
      expect(result).toEqual({ message: 'User deleted' });
    });
  });

  // ========== Audit Logs ==========

  describe('getAuditLogs', () => {
    it('should pass pagination and filters to adminService.getAuditLogs', async () => {
      await controller.getAuditLogs(2, 25, 'admin-1', 'BAN_USER', 'users');

      expect(adminService.getAuditLogs).toHaveBeenCalledWith(2, 25, {
        adminId: 'admin-1',
        action: 'BAN_USER',
        resource: 'users',
      });
    });

    it('should default page=1 and pageSize=50 when not provided', async () => {
      await controller.getAuditLogs(
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      );

      expect(adminService.getAuditLogs).toHaveBeenCalledWith(1, 50, {
        adminId: undefined,
        action: undefined,
        resource: undefined,
      });
    });
  });

  // ========== School Deadlines ==========

  describe('getSchoolDeadlines', () => {
    it('should pass filters to adminService.getSchoolDeadlines', async () => {
      await controller.getSchoolDeadlines('school-1', 2025, 2, 10);

      expect(adminService.getSchoolDeadlines).toHaveBeenCalledWith(
        'school-1',
        2025,
        2,
        10,
      );
    });

    it('should default page=1 and pageSize=50 when not provided', async () => {
      await controller.getSchoolDeadlines(
        undefined,
        undefined,
        undefined,
        undefined,
      );

      expect(adminService.getSchoolDeadlines).toHaveBeenCalledWith(
        undefined,
        undefined,
        1,
        50,
      );
    });
  });

  describe('createSchoolDeadline', () => {
    it('should call createSchoolDeadline with the dto', async () => {
      const dto = { schoolId: 'school-1', deadline: '2025-12-01' } as any;
      const result = await controller.createSchoolDeadline(dto);

      expect(adminService.createSchoolDeadline).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ id: 'deadline-1' });
    });
  });

  describe('updateSchoolDeadline', () => {
    it('should call updateSchoolDeadline with id and dto', async () => {
      const dto = { deadline: '2025-12-15' } as any;
      const result = await controller.updateSchoolDeadline('deadline-1', dto);

      expect(adminService.updateSchoolDeadline).toHaveBeenCalledWith(
        'deadline-1',
        dto,
      );
      expect(result).toEqual({ id: 'deadline-1' });
    });
  });

  describe('deleteSchoolDeadline', () => {
    it('should delete deadline and return confirmation message', async () => {
      const result = await controller.deleteSchoolDeadline('deadline-1');

      expect(adminService.deleteSchoolDeadline).toHaveBeenCalledWith(
        'deadline-1',
      );
      expect(result).toEqual({ message: 'Deadline deleted' });
    });
  });

  // ========== Global Events ==========

  describe('getGlobalEvents', () => {
    it('should pass filters to adminService.getGlobalEvents', async () => {
      await controller.getGlobalEvents(
        GlobalEventCategory.APPLICATION,
        2025,
        1,
        20,
      );

      expect(adminService.getGlobalEvents).toHaveBeenCalledWith(
        GlobalEventCategory.APPLICATION,
        2025,
        1,
        20,
      );
    });

    it('should default page=1 and pageSize=50 when not provided', async () => {
      await controller.getGlobalEvents(
        undefined,
        undefined,
        undefined,
        undefined,
      );

      expect(adminService.getGlobalEvents).toHaveBeenCalledWith(
        undefined,
        undefined,
        1,
        50,
      );
    });
  });

  describe('createGlobalEvent', () => {
    it('should call createGlobalEvent with the dto', async () => {
      const dto = {
        title: 'New Event',
        category: GlobalEventCategory.APPLICATION,
      } as any;
      const result = await controller.createGlobalEvent(dto);

      expect(adminService.createGlobalEvent).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ id: 'event-1' });
    });
  });

  describe('updateGlobalEvent', () => {
    it('should call updateGlobalEvent with id and dto', async () => {
      const dto = { title: 'Updated Event' } as any;
      const result = await controller.updateGlobalEvent('event-1', dto);

      expect(adminService.updateGlobalEvent).toHaveBeenCalledWith(
        'event-1',
        dto,
      );
      expect(result).toEqual({ id: 'event-1' });
    });
  });

  describe('deleteGlobalEvent', () => {
    it('should delete event and return confirmation message', async () => {
      const result = await controller.deleteGlobalEvent('event-1');

      expect(adminService.deleteGlobalEvent).toHaveBeenCalledWith('event-1');
      expect(result).toEqual({ message: 'Event deleted' });
    });
  });
});
