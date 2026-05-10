import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { DashboardService } from './dashboard.service';
import { CaseIncentiveService } from '../points/incentive.service';
import { PointsConfigService } from '../points/points-config.service';

describe('UserController', () => {
  let controller: UserController;
  let userService: UserService;
  let dashboardService: DashboardService;
  let caseIncentiveService: CaseIncentiveService;
  let pointsConfigService: PointsConfigService;

  const mockUser = {
    id: 'user-1',
    email: 'test@test.com',
    role: 'USER',
    locale: 'zh',
  };

  const mockFullUser = {
    id: 'user-1',
    email: 'test@test.com',
    role: 'USER',
    passwordHash: 'hashed_password',
    createdAt: new Date(),
  };

  const mockDashboard = {
    profileCompletion: 75,
    applicationCount: 3,
    upcomingDeadlines: [],
  };

  const mockPointHistory = [
    { id: 'ph-1', action: 'SHARE_CASE', points: 10, createdAt: new Date() },
    { id: 'ph-2', action: 'VIEW_CASE', points: -5, createdAt: new Date() },
  ];

  const mockPointRules = [
    {
      action: 'SHARE_CASE',
      points: 10,
      type: 'earn',
      description: 'Share a case',
    },
    {
      action: 'VIEW_CASE',
      points: -5,
      type: 'spend',
      description: 'View a case',
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: UserService,
          useValue: {
            findByIdOrThrow: jest.fn().mockResolvedValue(mockFullUser),
            update: jest.fn().mockResolvedValue({
              ...mockFullUser,
              locale: 'en',
            }),
            softDelete: jest.fn().mockResolvedValue(undefined),
            exportUserData: jest.fn().mockResolvedValue({ user: mockFullUser }),
            getOrCreateReferralCode: jest.fn().mockResolvedValue('REF123'),
            getReferralStats: jest.fn().mockResolvedValue({
              referralCount: 5,
              totalPointsEarned: 50,
            }),
            getReferralList: jest.fn().mockResolvedValue({
              referrals: [
                {
                  id: 'ref-1',
                  email: 'referred@test.com',
                  joinedAt: new Date(),
                  pointsEarned: 10,
                },
              ],
              total: 1,
            }),
          },
        },
        {
          provide: DashboardService,
          useValue: {
            getDashboardSummary: jest.fn().mockResolvedValue(mockDashboard),
          },
        },
        {
          provide: CaseIncentiveService,
          useValue: {
            getUserPoints: jest.fn().mockResolvedValue(100),
            getPointHistory: jest.fn().mockResolvedValue(mockPointHistory),
          },
        },
        {
          provide: PointsConfigService,
          useValue: {
            getAllRules: jest.fn().mockResolvedValue(mockPointRules),
          },
        },
      ],
    }).compile();

    controller = module.get<UserController>(UserController);
    userService = module.get<UserService>(UserService);
    dashboardService = module.get<DashboardService>(DashboardService);
    caseIncentiveService =
      module.get<CaseIncentiveService>(CaseIncentiveService);
    pointsConfigService = module.get<PointsConfigService>(PointsConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getDashboard', () => {
    it('should return dashboard summary for the user', async () => {
      const result = await controller.getDashboard(mockUser);

      expect(dashboardService.getDashboardSummary).toHaveBeenCalledWith(
        'user-1',
        'zh',
      );
      expect(result).toEqual(mockDashboard);
    });
  });

  describe('getCurrentUser', () => {
    it('should return user info without passwordHash', async () => {
      const result = await controller.getCurrentUser(mockUser);

      expect(userService.findByIdOrThrow).toHaveBeenCalledWith('user-1');
      expect(result).not.toHaveProperty('passwordHash');
      expect(result).toHaveProperty('email', 'test@test.com');
    });
  });

  describe('updateCurrentUser', () => {
    it('should update only the current user locale and return safe user data', async () => {
      const result = await controller.updateCurrentUser(mockUser, {
        locale: 'en',
      });

      expect(userService.update).toHaveBeenCalledWith('user-1', {
        locale: 'en',
      });
      expect(result).not.toHaveProperty('passwordHash');
      expect(result).toHaveProperty('locale', 'en');
    });
  });

  describe('deleteAccount', () => {
    it('should soft delete the user and return success message', async () => {
      const result = await controller.deleteAccount(mockUser);

      expect(userService.softDelete).toHaveBeenCalledWith('user-1');
      expect(result.success).toBe(true);
      expect(result.message).toContain('deleted');
    });
  });

  describe('exportData', () => {
    it('should export user data and set response headers', async () => {
      const mockResponse = {
        setHeader: jest.fn(),
      };

      const result = await controller.exportData(mockUser, mockResponse as any);

      expect(userService.exportUserData).toHaveBeenCalledWith('user-1');
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/json',
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringContaining('user-data-user-1.json'),
      );
      expect(result).toEqual({ user: mockFullUser });
    });
  });

  describe('getMyPoints', () => {
    it('should return the current user points', async () => {
      const result = await controller.getMyPoints(mockUser);

      expect(caseIncentiveService.getUserPoints).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({ points: 100 });
    });
  });

  describe('getPointHistory', () => {
    it('should return enriched point history with default limit', async () => {
      const result = await controller.getPointHistory(mockUser, undefined);

      expect(caseIncentiveService.getPointHistory).toHaveBeenCalledWith(
        'user-1',
        20,
      );
      expect(pointsConfigService.getAllRules).toHaveBeenCalled();
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('description');
      expect(result[0]).toHaveProperty('type', 'earn');
      expect(result[1]).toHaveProperty('type', 'spend');
    });

    it('should use provided limit', async () => {
      await controller.getPointHistory(mockUser, '5');

      expect(caseIncentiveService.getPointHistory).toHaveBeenCalledWith(
        'user-1',
        5,
      );
    });
  });

  describe('getPointRules', () => {
    it('should return earn and spend rules', async () => {
      const result = await controller.getPointRules();

      expect(pointsConfigService.getAllRules).toHaveBeenCalled();
      expect(result.earn).toHaveLength(1);
      expect(result.spend).toHaveLength(1);
      expect(result.earn[0].action).toBe('SHARE_CASE');
      expect(result.spend[0].action).toBe('VIEW_CASE');
    });
  });

  describe('getReferral', () => {
    it('should return referral code, link, and stats', async () => {
      const result = await controller.getReferral(mockUser);

      expect(userService.getOrCreateReferralCode).toHaveBeenCalledWith(
        'user-1',
      );
      expect(userService.getReferralStats).toHaveBeenCalledWith('user-1');
      expect(result.referralCode).toBe('REF123');
      expect(result.referralLink).toContain('ref=REF123');
      expect(result.referralCount).toBe(5);
      expect(result.totalPointsEarned).toBe(50);
    });
  });

  describe('getReferralList', () => {
    it('should return list of referred users', async () => {
      const result = await controller.getReferralList(mockUser);

      expect(userService.getReferralList).toHaveBeenCalledWith('user-1');
      expect(result.referrals).toHaveLength(1);
      expect(result.referrals[0].email).toBe('referred@test.com');
    });
  });

  describe('getPointSummary', () => {
    it('should return point summary statistics', async () => {
      const result = await controller.getPointSummary(mockUser);

      expect(caseIncentiveService.getUserPoints).toHaveBeenCalledWith('user-1');
      expect(caseIncentiveService.getPointHistory).toHaveBeenCalledWith(
        'user-1',
        100,
      );
      expect(result.currentPoints).toBe(100);
      expect(result.totalEarned).toBe(10);
      expect(result.totalSpent).toBe(5);
      expect(result.transactionCount).toBe(2);
      expect(result.actionStats).toEqual({ SHARE_CASE: 1, VIEW_CASE: 1 });
    });
  });
});
