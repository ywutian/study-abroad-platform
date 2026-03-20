import { Test, TestingModule } from '@nestjs/testing';
import { CaseController } from './case.controller';
import { CaseService } from './case.service';

describe('CaseController', () => {
  let controller: CaseController;
  let caseService: CaseService;

  const mockUser = {
    id: 'user-1',
    email: 'test@test.com',
    role: 'USER',
    locale: 'zh',
  };

  const mockCase = {
    id: 'case-1',
    userId: 'user-1',
    schoolId: 'school-1',
    year: 2025,
    result: 'ACCEPTED',
    gpa: 3.9,
  };

  const mockCaseListResult = {
    items: [mockCase],
    total: 1,
    page: 1,
    pageSize: 10,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CaseController],
      providers: [
        {
          provide: CaseService,
          useValue: {
            findAll: jest.fn().mockResolvedValue(mockCaseListResult),
            getMyCases: jest.fn().mockResolvedValue([mockCase]),
            findById: jest.fn().mockResolvedValue(mockCase),
            create: jest.fn().mockResolvedValue(mockCase),
            update: jest.fn().mockResolvedValue(mockCase),
            delete: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    controller = module.get<CaseController>(CaseController);
    caseService = module.get<CaseService>(CaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should call caseService.findAll with pagination, filters, userId and role', async () => {
      const query = {
        page: 1,
        pageSize: 10,
        schoolId: 'school-1',
        year: 2025,
        result: 'ACCEPTED',
        search: 'MIT',
      } as any;

      const result = await controller.findAll(mockUser as any, query);

      expect(caseService.findAll).toHaveBeenCalledWith(
        { page: 1, pageSize: 10 },
        {
          schoolId: 'school-1',
          year: 2025,
          result: 'ACCEPTED',
          search: 'MIT',
        },
        'user-1',
        'USER',
      );
      expect(result).toEqual(mockCaseListResult);
    });

    it('should handle null user (public access)', async () => {
      const query = { page: 1, pageSize: 10 } as any;

      await controller.findAll(null, query);

      expect(caseService.findAll).toHaveBeenCalledWith(
        { page: 1, pageSize: 10 },
        expect.objectContaining({}),
        undefined,
        null,
      );
    });
  });

  describe('getMyCases', () => {
    it('should call caseService.getMyCases with userId', async () => {
      const result = await controller.getMyCases(mockUser as any);

      expect(caseService.getMyCases).toHaveBeenCalledWith('user-1');
      expect(result).toEqual([mockCase]);
    });
  });

  describe('findById', () => {
    it('should call caseService.findById with id, userId and role', async () => {
      const result = await controller.findById(mockUser as any, 'case-1');

      expect(caseService.findById).toHaveBeenCalledWith(
        'case-1',
        'user-1',
        'USER',
        'zh',
      );
      expect(result).toEqual(mockCase);
    });

    it('should handle null user for public access', async () => {
      await controller.findById(null, 'case-1');

      expect(caseService.findById).toHaveBeenCalledWith(
        'case-1',
        null,
        null,
        'zh',
      );
    });
  });

  describe('create', () => {
    it('should call caseService.create with userId and dto', async () => {
      const dto = {
        schoolId: 'school-1',
        year: 2025,
        result: 'ACCEPTED',
      } as any;

      const result = await controller.create(mockUser as any, dto);

      expect(caseService.create).toHaveBeenCalledWith(
        'user-1',
        dto,
        'zh',
        'USER',
      );
      expect(result).toEqual(mockCase);
    });
  });

  describe('update', () => {
    it('should call caseService.update with id, userId and dto', async () => {
      const dto = { result: 'REJECTED' } as any;

      const result = await controller.update(mockUser as any, 'case-1', dto);

      expect(caseService.update).toHaveBeenCalledWith('case-1', 'user-1', dto);
      expect(result).toEqual(mockCase);
    });
  });

  describe('delete', () => {
    it('should call caseService.delete with id and userId and return success message', async () => {
      const result = await controller.delete(mockUser as any, 'case-1');

      expect(caseService.delete).toHaveBeenCalledWith('case-1', 'user-1');
      expect(result).toEqual({ message: 'Case deleted successfully' });
    });
  });
});
