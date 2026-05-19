import { Test, TestingModule } from '@nestjs/testing';
import { HallController } from './hall.controller';
import { HallService } from './hall.service';
import { SwipeService } from './swipe.service';
import { HallOverviewService } from './hall-overview.service';
import { HallVerifiedDashboardService } from './hall-verified-dashboard.service';

describe('HallController', () => {
  let controller: HallController;
  let hallService: HallService;
  let swipeService: SwipeService;

  const mockUser = {
    id: 'user-1',
    email: 'test@test.com',
    role: 'USER',
    locale: 'zh',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HallController],
      providers: [
        {
          provide: HallService,
          useValue: {
            getBatchRanking: jest.fn(),
            getTargetSchoolRanking: jest.fn(),
            getProfileRanking: jest.fn(),
            getRankingAnalysis: jest.fn(),
            getPublicLists: jest.fn(),
            getMyLists: jest.fn(),
            getListById: jest.fn(),
            createList: jest.fn(),
            updateList: jest.fn(),
            deleteList: jest.fn(),
            voteList: jest.fn(),
            removeVote: jest.fn(),
            getVerifiedRanking: jest.fn(),
            getAvailableYears: jest.fn(),
          },
        },
        {
          provide: SwipeService,
          useValue: {
            getNextCases: jest.fn(),
            submitSwipe: jest.fn(),
            getStats: jest.fn(),
          },
        },
        {
          provide: HallOverviewService,
          useValue: {
            getOverview: jest.fn().mockResolvedValue({}),
          },
        },
        {
          provide: HallVerifiedDashboardService,
          useValue: {
            getChinaAdmitTrend: jest
              .fn()
              .mockResolvedValue({ schools: [], lastUpdated: '' }),
            getDifficultySignal: jest.fn().mockResolvedValue([]),
            getEdRdComparison: jest
              .fn()
              .mockResolvedValue({ year: 2024, schools: [] }),
          },
        },
      ],
    }).compile();

    controller = module.get<HallController>(HallController);
    hallService = module.get<HallService>(HallService);
    swipeService = module.get<SwipeService>(SwipeService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================
  // Batch Ranking
  // ============================================

  it('POST /ranking should call getBatchRanking with user.id and schoolIds', async () => {
    const data = { schoolIds: ['s-1', 's-2'] } as any;
    const expected = [{ schoolId: 's-1', rank: 5 }];
    (hallService.getBatchRanking as jest.Mock).mockResolvedValue(expected);

    const result = await controller.getBatchRanking(mockUser, data);

    expect(hallService.getBatchRanking).toHaveBeenCalledWith(
      'user-1',
      ['s-1', 's-2'],
      'zh',
    );
    expect(result).toEqual(expected);
  });

  // ============================================
  // Ranking
  // ============================================

  it('GET /target-ranking should call getTargetSchoolRanking with user.id', async () => {
    const expected = [{ schoolId: 's-1', rank: 3 }];
    (hallService.getTargetSchoolRanking as jest.Mock).mockResolvedValue(
      expected,
    );

    const result = await controller.getTargetSchoolRanking(mockUser);

    expect(hallService.getTargetSchoolRanking).toHaveBeenCalledWith('user-1');
    expect(result).toEqual(expected);
  });

  it('GET /ranking/:schoolId should call getProfileRanking with user.id and schoolId', async () => {
    const expected = { rank: 5, total: 100 };
    (hallService.getProfileRanking as jest.Mock).mockResolvedValue(expected);

    const result = await controller.getProfileRanking(mockUser, 'school-1');

    expect(hallService.getProfileRanking).toHaveBeenCalledWith(
      'user-1',
      'school-1',
    );
    expect(result).toEqual(expected);
  });

  it('POST /ranking-analysis should call getRankingAnalysis with user.id and schoolId', async () => {
    const expected = { analysis: 'You are competitive' };
    (hallService.getRankingAnalysis as jest.Mock).mockResolvedValue(expected);

    const result = await controller.getRankingAnalysis(mockUser, {
      schoolId: 'school-1',
    });

    expect(hallService.getRankingAnalysis).toHaveBeenCalledWith(
      'user-1',
      'school-1',
      'zh',
    );
    expect(result).toEqual(expected);
  });

  // ============================================
  // User Lists
  // ============================================

  it('GET /lists should call getPublicLists with pagination and category', async () => {
    const pagination = { page: 1, pageSize: 10 } as any;
    const expected = { data: [], total: 0 };
    (hallService.getPublicLists as jest.Mock).mockResolvedValue(expected);

    const result = await controller.getPublicLists(pagination, 'favorites');

    expect(hallService.getPublicLists).toHaveBeenCalledWith(
      pagination,
      'favorites',
    );
    expect(result).toEqual(expected);
  });

  it('GET /lists/me should call getMyLists with user.id', async () => {
    const expected = [{ id: 'list-1' }];
    (hallService.getMyLists as jest.Mock).mockResolvedValue(expected);

    const result = await controller.getMyLists(mockUser);

    expect(hallService.getMyLists).toHaveBeenCalledWith('user-1');
    expect(result).toEqual(expected);
  });

  it('GET /lists/:id should call getListById with id', async () => {
    const expected = { id: 'list-1', name: 'Top Schools' };
    (hallService.getListById as jest.Mock).mockResolvedValue(expected);

    const result = await controller.getListById('list-1');

    expect(hallService.getListById).toHaveBeenCalledWith('list-1');
    expect(result).toEqual(expected);
  });

  it('POST /lists should call createList with user.id and data', async () => {
    const data = { name: 'My List', schools: ['s-1'] } as any;
    const expected = { id: 'list-1' };
    (hallService.createList as jest.Mock).mockResolvedValue(expected);

    const result = await controller.createList(mockUser, data);

    expect(hallService.createList).toHaveBeenCalledWith('user-1', data);
    expect(result).toEqual(expected);
  });

  it('PUT /lists/:id should call updateList with id, user.id, data', async () => {
    const data = { name: 'Updated List' } as any;
    const expected = { id: 'list-1', name: 'Updated List' };
    (hallService.updateList as jest.Mock).mockResolvedValue(expected);

    const result = await controller.updateList(mockUser, 'list-1', data);

    expect(hallService.updateList).toHaveBeenCalledWith(
      'list-1',
      'user-1',
      data,
    );
    expect(result).toEqual(expected);
  });

  it('DELETE /lists/:id should call deleteList and return { success: true }', async () => {
    (hallService.deleteList as jest.Mock).mockResolvedValue(undefined);

    const result = await controller.deleteList(mockUser, 'list-1');

    expect(hallService.deleteList).toHaveBeenCalledWith('list-1', 'user-1');
    expect(result).toEqual({ success: true });
  });

  it('POST /lists/:id/vote should call voteList with id, user.id, value', async () => {
    const data = { value: 1 } as any;
    const expected = { success: true };
    (hallService.voteList as jest.Mock).mockResolvedValue(expected);

    const result = await controller.voteList(mockUser, 'list-1', data);

    expect(hallService.voteList).toHaveBeenCalledWith('list-1', 'user-1', 1);
    expect(result).toEqual(expected);
  });

  it('DELETE /lists/:id/vote should call removeVote and return { success: true }', async () => {
    (hallService.removeVote as jest.Mock).mockResolvedValue(undefined);

    const result = await controller.removeVote(mockUser, 'list-1');

    expect(hallService.removeVote).toHaveBeenCalledWith('list-1', 'user-1');
    expect(result).toEqual({ success: true });
  });

  // ============================================
  // Verified User Ranking
  // ============================================

  it('GET /verified-ranking should call getVerifiedRanking with query', async () => {
    const query = { year: 2025, page: 1 } as any;
    const expected = { data: [], total: 0 };
    (hallService.getVerifiedRanking as jest.Mock).mockResolvedValue(expected);

    const result = await controller.getVerifiedRanking(query);

    expect(hallService.getVerifiedRanking).toHaveBeenCalledWith(query);
    expect(result).toEqual(expected);
  });

  it('GET /verified-ranking/years should call getAvailableYears', async () => {
    const expected = [2024, 2025];
    (hallService.getAvailableYears as jest.Mock).mockResolvedValue(expected);

    const result = await controller.getAvailableYears();

    expect(hallService.getAvailableYears).toHaveBeenCalled();
    expect(result).toEqual(expected);
  });

  // ============================================
  // Swipe Game
  // ============================================

  it('GET /swipe/batch should call swipeService.getNextCases with user.id and count', async () => {
    const query = { count: 10 } as any;
    const expected = { cases: [], remaining: 0 };
    (swipeService.getNextCases as jest.Mock).mockResolvedValue(expected);

    const result = await controller.getNextCases(mockUser, query);

    expect(swipeService.getNextCases).toHaveBeenCalledWith('user-1', 10);
    expect(result).toEqual(expected);
  });

  it('POST /swipe/predict should call swipeService.submitSwipe with user.id and dto', async () => {
    const dto = { caseId: 'case-1', prediction: 'ADMIT' } as any;
    const expected = { correct: true, actualResult: 'ADMIT' };
    (swipeService.submitSwipe as jest.Mock).mockResolvedValue(expected);

    const result = await controller.submitSwipe(mockUser, dto);

    expect(swipeService.submitSwipe).toHaveBeenCalledWith('user-1', dto);
    expect(result).toEqual(expected);
  });

  it('GET /swipe/stats should call swipeService.getStats with user.id', async () => {
    const expected = { total: 50, correct: 40, accuracy: 0.8 };
    (swipeService.getStats as jest.Mock).mockResolvedValue(expected);

    const result = await controller.getSwipeStats(mockUser);

    expect(swipeService.getStats).toHaveBeenCalledWith('user-1');
    expect(result).toEqual(expected);
  });
});
