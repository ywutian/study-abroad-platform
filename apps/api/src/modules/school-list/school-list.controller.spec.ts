import { Test, TestingModule } from '@nestjs/testing';
import { SchoolListController } from './school-list.controller';
import { SchoolListService } from './school-list.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

describe('SchoolListController', () => {
  let controller: SchoolListController;
  let service: SchoolListService;

  const userId = 'user-1';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SchoolListController],
      providers: [
        {
          provide: SchoolListService,
          useValue: {
            getUserSchoolList: jest
              .fn()
              .mockResolvedValue([{ id: 'item-1', schoolName: 'MIT' }]),
            addSchool: jest
              .fn()
              .mockResolvedValue({ id: 'item-2', schoolName: 'Stanford' }),
            updateItem: jest
              .fn()
              .mockResolvedValue({ id: 'item-1', status: 'APPLIED' }),
            removeItem: jest.fn().mockResolvedValue(undefined),
            getAIRecommendations: jest
              .fn()
              .mockResolvedValue({ recommendations: [] }),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<SchoolListController>(SchoolListController);
    service = module.get<SchoolListService>(SchoolListService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('getMySchoolList', () => {
    it('should delegate to schoolListService.getUserSchoolList', async () => {
      const result = await controller.getMySchoolList(userId);

      expect(service.getUserSchoolList).toHaveBeenCalledWith('user-1');
      expect(result).toEqual([{ id: 'item-1', schoolName: 'MIT' }]);
    });
  });

  describe('addSchool', () => {
    it('should delegate to schoolListService.addSchool', async () => {
      const dto = { schoolName: 'Stanford', category: 'REACH' } as any;
      const result = await controller.addSchool(userId, dto);

      expect(service.addSchool).toHaveBeenCalledWith('user-1', dto);
      expect(result).toEqual({ id: 'item-2', schoolName: 'Stanford' });
    });
  });

  describe('updateItem', () => {
    it('should delegate to schoolListService.updateItem', async () => {
      const dto = { status: 'APPLIED' } as any;
      const result = await controller.updateItem(userId, 'item-1', dto);

      expect(service.updateItem).toHaveBeenCalledWith('user-1', 'item-1', dto);
      expect(result).toEqual({ id: 'item-1', status: 'APPLIED' });
    });
  });

  describe('removeItem', () => {
    it('should delegate to schoolListService.removeItem', async () => {
      const result = await controller.removeItem(userId, 'item-1');

      expect(service.removeItem).toHaveBeenCalledWith('user-1', 'item-1');
      expect(result).toBeUndefined();
    });
  });

  describe('getAIRecommendations', () => {
    it('should delegate to schoolListService.getAIRecommendations', async () => {
      const result = await controller.getAIRecommendations(userId);

      expect(service.getAIRecommendations).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({ recommendations: [] });
    });
  });
});
