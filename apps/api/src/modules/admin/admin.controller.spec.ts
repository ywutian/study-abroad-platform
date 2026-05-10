import { Test, TestingModule } from '@nestjs/testing';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminDataSyncService } from './admin-data-sync.service';
import { NotificationService } from '../notification/notification.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PredictionService } from '../prediction/prediction.service';
import { PredictionCalibrationService } from '../prediction/prediction-calibration.service';
import { PredictionReportingService } from '../prediction/prediction-reporting.service';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { Role, GlobalEventCategory } from '@prisma/client';

describe('AdminController', () => {
  let controller: AdminController;
  let adminService: jest.Mocked<AdminService>;
  let permissionGuard: jest.Mocked<PermissionGuard>;

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
          provide: AdminDataSyncService,
          useValue: {
            getDataSyncJobs: jest.fn().mockResolvedValue([]),
            triggerDataSync: jest.fn().mockResolvedValue({ synced: 0 }),
          },
        },
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
          provide: PredictionService,
          useValue: {
            invalidateCalibrationCache: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: PredictionCalibrationService,
          useValue: {
            getCalibrationData: jest.fn().mockResolvedValue([]),
            runCalibration: jest.fn().mockResolvedValue({ adjustments: [] }),
          },
        },
        {
          provide: PredictionReportingService,
          useValue: {
            getAccuracyReport: jest.fn().mockResolvedValue({}),
          },
        },
        {
          provide: PermissionGuard,
          useValue: {
            getEffectivePermissions: jest
              .fn()
              .mockResolvedValue(['dashboard:full', 'case:review']),
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
            getMatchPools: jest.fn().mockResolvedValue([]),
            createMatchPool: jest.fn().mockResolvedValue({ id: 'pool-1' }),
            updateMatchPool: jest.fn().mockResolvedValue({ id: 'pool-1' }),
            deleteMatchPool: jest.fn().mockResolvedValue(undefined),
            createMatchPoolEntry: jest
              .fn()
              .mockResolvedValue({ id: 'entry-1' }),
            updateMatchPoolEntry: jest
              .fn()
              .mockResolvedValue({ id: 'entry-1' }),
            deleteMatchPoolEntry: jest.fn().mockResolvedValue(undefined),
            getCommunityRecruitmentContexts: jest
              .fn()
              .mockResolvedValue([{ id: 'ctx-1' }]),
            reviewCommunityRecruitmentContext: jest
              .fn()
              .mockResolvedValue({ id: 'ctx-1', moderationStatus: 'APPROVED' }),
            promoteCommunityRecruitmentContext: jest
              .fn()
              .mockResolvedValue({ id: 'entry-2' }),
          },
        },
      ],
    }).compile();

    controller = module.get<AdminController>(AdminController);
    adminService = module.get(AdminService);
    permissionGuard = module.get(PermissionGuard);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ========== Stats ==========

  describe('getStats', () => {
    it('should return stats with permission-based filtering', async () => {
      const mockUser = {
        id: '1',
        email: 'admin@test.com',
        role: 'ADMIN',
        locale: 'en',
      } as any;
      const result = await controller.getStats(mockUser);

      expect(permissionGuard.getEffectivePermissions).toHaveBeenCalledWith(
        '1',
        'ADMIN',
      );
      expect(adminService.getStats).toHaveBeenCalledWith('ADMIN', true);
      expect(result).toEqual({ users: 100, reports: 5 });
    });
  });

  describe('getTrends', () => {
    it('should return trends with permission-based filtering', async () => {
      const mockUser = {
        id: '1',
        email: 'admin@test.com',
        role: 'ADMIN',
        locale: 'en',
      } as any;
      const result = await controller.getTrends(mockUser);

      expect(permissionGuard.getEffectivePermissions).toHaveBeenCalledWith(
        '1',
        'ADMIN',
      );
      expect(adminService.getTrends).toHaveBeenCalledWith('ADMIN', true);
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
        priority: 'HIGH' as any,
        assignedTo: 'admin-1',
      };
      await controller.getReports(query);

      expect(adminService.getReports).toHaveBeenCalledWith(
        'PENDING',
        'POST',
        2,
        10,
        'HIGH',
        'admin-1',
      );
    });

    it('should default page=1 and pageSize=20', async () => {
      await controller.getReports({});

      expect(adminService.getReports).toHaveBeenCalledWith(
        undefined,
        undefined,
        1,
        20,
        undefined,
        undefined,
      );
    });
  });

  describe('updateReport', () => {
    it('should call updateReportStatus with admin id, report id, status and resolution', async () => {
      const dto = { status: 'RESOLVED' as any, resolution: 'Spam removed' };
      const result = await controller.updateReport(mockAdmin, 'report-1', dto);

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
      const result = await controller.deleteReport(mockAdmin, 'report-1');

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
      await controller.getUsers({});

      expect(adminService.getUsers).toHaveBeenCalledWith(
        undefined,
        undefined,
        1,
        20,
      );
    });
  });

  describe('banUser', () => {
    it('should call banUser with admin id, user id, reason, duration and permanent', async () => {
      const dto = { reason: 'Spamming', durationHours: 24, permanent: false };
      const result = await controller.banUser(mockAdmin, 'user-1', dto);

      expect(adminService.banUser).toHaveBeenCalledWith(
        'admin-1',
        'user-1',
        'Spamming',
        24,
        false,
        'ADMIN',
      );
      expect(result).toEqual({ id: 'user-1', banned: true });
    });
  });

  describe('unbanUser', () => {
    it('should call unbanUser with admin id and user id', async () => {
      const result = await controller.unbanUser(mockAdmin, 'user-1');

      expect(adminService.unbanUser).toHaveBeenCalledWith('admin-1', 'user-1');
      expect(result).toEqual({ id: 'user-1', banned: false });
    });
  });

  describe('deleteUser', () => {
    it('should delete user and return confirmation message', async () => {
      const result = await controller.deleteUser(mockAdmin, 'user-1');

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

  // ========== Match Pools / Community Context Moderation ==========

  describe('getMatchPools', () => {
    it('should return match pools from adminService', async () => {
      await controller.getMatchPools();

      expect(adminService.getMatchPools).toHaveBeenCalledTimes(1);
    });
  });

  describe('createMatchPool', () => {
    it('should call createMatchPool with the dto', async () => {
      const dto = { name: 'Popular Main Competitions', sortOrder: 0 } as any;
      const result = await controller.createMatchPool(dto);

      expect(adminService.createMatchPool).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ id: 'pool-1' });
    });
  });

  describe('updateMatchPool', () => {
    it('should call updateMatchPool with id and dto', async () => {
      const dto = { name: 'Updated Pool' } as any;
      const result = await controller.updateMatchPool('pool-1', dto);

      expect(adminService.updateMatchPool).toHaveBeenCalledWith('pool-1', dto);
      expect(result).toEqual({ id: 'pool-1' });
    });
  });

  describe('deleteMatchPool', () => {
    it('should delete the pool and return a confirmation message', async () => {
      const result = await controller.deleteMatchPool('pool-1');

      expect(adminService.deleteMatchPool).toHaveBeenCalledWith('pool-1');
      expect(result).toEqual({ message: 'Match pool deleted' });
    });
  });

  describe('createMatchPoolEntry', () => {
    it('should create a match pool entry within the selected pool', async () => {
      const dto = {
        entryType: 'OFFICIAL_COMPETITION',
        competitionId: 'comp-1',
      } as any;
      const result = await controller.createMatchPoolEntry('pool-1', dto);

      expect(adminService.createMatchPoolEntry).toHaveBeenCalledWith(
        'pool-1',
        dto,
      );
      expect(result).toEqual({ id: 'entry-1' });
    });
  });

  describe('updateMatchPoolEntry', () => {
    it('should update a specific match pool entry', async () => {
      const dto = { sortOrder: 2 } as any;
      const result = await controller.updateMatchPoolEntry('entry-1', dto);

      expect(adminService.updateMatchPoolEntry).toHaveBeenCalledWith(
        'entry-1',
        dto,
      );
      expect(result).toEqual({ id: 'entry-1' });
    });
  });

  describe('deleteMatchPoolEntry', () => {
    it('should delete a match pool entry and return a confirmation message', async () => {
      const result = await controller.deleteMatchPoolEntry('entry-1');

      expect(adminService.deleteMatchPoolEntry).toHaveBeenCalledWith('entry-1');
      expect(result).toEqual({ message: 'Match pool entry deleted' });
    });
  });

  describe('getCommunityRecruitmentContexts', () => {
    it('should pass the moderation status filter to adminService', async () => {
      await controller.getCommunityRecruitmentContexts({
        status: 'PENDING_REVIEW',
      } as any);

      expect(adminService.getCommunityRecruitmentContexts).toHaveBeenCalledWith(
        'PENDING_REVIEW',
      );
    });
  });

  describe('reviewCommunityRecruitmentContext', () => {
    it('should review the selected community recruitment context', async () => {
      const dto = { status: 'APPROVED' } as any;
      const result = await controller.reviewCommunityRecruitmentContext(
        'ctx-1',
        dto,
      );

      expect(
        adminService.reviewCommunityRecruitmentContext,
      ).toHaveBeenCalledWith('ctx-1', 'APPROVED');
      expect(result).toEqual({ id: 'ctx-1', moderationStatus: 'APPROVED' });
    });
  });

  describe('promoteCommunityRecruitmentContext', () => {
    it('should promote an approved community context into the selected public pool', async () => {
      const dto = { matchPoolId: 'pool-1', sortOrder: 1 } as any;
      const result = await controller.promoteCommunityRecruitmentContext(
        'ctx-1',
        dto,
      );

      expect(
        adminService.promoteCommunityRecruitmentContext,
      ).toHaveBeenCalledWith('ctx-1', dto);
      expect(result).toEqual({ id: 'entry-2' });
    });
  });
});
