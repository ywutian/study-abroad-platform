import { Test, TestingModule } from '@nestjs/testing';
import { RankingController } from './ranking.controller';
import { RankingService } from './ranking.service';

describe('RankingController', () => {
  let controller: RankingController;
  let rankingService: RankingService;

  const mockUser = {
    id: 'user-1',
    email: 'test@test.com',
    role: 'USER',
    locale: 'zh',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RankingController],
      providers: [
        {
          provide: RankingService,
          useValue: {
            calculateRanking: jest.fn(),
            saveRanking: jest.fn(),
            getUserRankings: jest.fn(),
            getPublicRankings: jest.fn(),
            findById: jest.fn(),
            deleteRanking: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<RankingController>(RankingController);
    rankingService = module.get<RankingService>(RankingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('POST /calculate should call calculateRanking with sanitized weights', async () => {
    const weights = {
      usNewsRank: 0.4,
      acceptanceRate: 0.2,
      tuition: 0.2,
      avgSalary: 0.2,
    };
    const expected = [{ school: 'MIT', score: 95 }];
    (rankingService.calculateRanking as jest.Mock).mockResolvedValue(expected);

    const result = await controller.calculateRanking(weights);

    // Controller calls sanitizeRankingWeights which fills in niche defaults (0)
    expect(rankingService.calculateRanking).toHaveBeenCalledWith({
      ...weights,
      nicheOverall: 0,
      safetyGrade: 0,
      studentLifeGrade: 0,
      campusFoodGrade: 0,
    });
    expect(result).toEqual(expected);
  });

  it('POST / should call saveRanking with user.id, name, sanitized weights, isPublic', async () => {
    const data = {
      name: 'My Ranking',
      isPublic: true,
      usNewsRank: 0.4,
      acceptanceRate: 0.2,
      tuition: 0.2,
      avgSalary: 0.2,
    };
    const expected = { id: 'rank-1', name: 'My Ranking' };
    (rankingService.saveRanking as jest.Mock).mockResolvedValue(expected);

    const result = await controller.saveRanking(mockUser as any, data);

    const { name: _name, isPublic: _isPublic, ...weights } = data;
    expect(rankingService.saveRanking).toHaveBeenCalledWith(
      'user-1',
      'My Ranking',
      {
        ...weights,
        nicheOverall: 0,
        safetyGrade: 0,
        studentLifeGrade: 0,
        campusFoodGrade: 0,
      },
      true,
    );
    expect(result).toEqual(expected);
  });

  it('POST /calculate should accept and forward niche weights', async () => {
    const weights = {
      usNewsRank: 20,
      acceptanceRate: 10,
      tuition: 10,
      avgSalary: 10,
      nicheOverall: 30,
      safetyGrade: 10,
      studentLifeGrade: 5,
      campusFoodGrade: 5,
    };
    (rankingService.calculateRanking as jest.Mock).mockResolvedValue([]);

    await controller.calculateRanking(weights);

    expect(rankingService.calculateRanking).toHaveBeenCalledWith(weights);
  });

  it('GET /me should call getUserRankings with user.id', async () => {
    const expected = [{ id: 'rank-1' }];
    (rankingService.getUserRankings as jest.Mock).mockResolvedValue(expected);

    const result = await controller.getMyRankings(mockUser as any);

    expect(rankingService.getUserRankings).toHaveBeenCalledWith('user-1');
    expect(result).toEqual(expected);
  });

  it('GET /public should call getPublicRankings', async () => {
    const expected = [{ id: 'rank-2', isPublic: true }];
    (rankingService.getPublicRankings as jest.Mock).mockResolvedValue(expected);

    const result = await controller.getPublicRankings();

    expect(rankingService.getPublicRankings).toHaveBeenCalled();
    expect(result).toEqual(expected);
  });

  it('GET /:id should call findById with id', async () => {
    const expected = { id: 'rank-1', name: 'Test' };
    (rankingService.findById as jest.Mock).mockResolvedValue(expected);

    const result = await controller.getRanking('rank-1');

    expect(rankingService.findById).toHaveBeenCalledWith('rank-1');
    expect(result).toEqual(expected);
  });

  it('DELETE /:id should call deleteRanking and return success message', async () => {
    (rankingService.deleteRanking as jest.Mock).mockResolvedValue(undefined);

    const result = await controller.deleteRanking(mockUser as any, 'rank-1');

    expect(rankingService.deleteRanking).toHaveBeenCalledWith(
      'rank-1',
      'user-1',
    );
    expect(result).toEqual({ message: 'Ranking deleted successfully' });
  });
});
