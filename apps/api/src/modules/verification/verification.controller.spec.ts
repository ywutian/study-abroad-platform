import { Test, TestingModule } from '@nestjs/testing';
import { VerificationController } from './verification.controller';
import { VerificationService } from './verification.service';
import { RolesGuard } from '../../common/guards/roles.guard';

describe('VerificationController', () => {
  let controller: VerificationController;
  let service: VerificationService;

  const mockUser = {
    id: 'user-1',
    email: 'test@test.com',
    role: 'USER',
    locale: 'zh',
  };
  const mockAdmin = {
    id: 'admin-1',
    email: 'admin@test.com',
    role: 'ADMIN',
    locale: 'zh',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VerificationController],
      providers: [
        {
          provide: VerificationService,
          useValue: {
            submitVerification: jest
              .fn()
              .mockResolvedValue({ id: 'ver-1', status: 'PENDING' }),
            getMyVerifications: jest.fn().mockResolvedValue([]),
            getPendingVerifications: jest
              .fn()
              .mockResolvedValue({ items: [], total: 0 }),
            getVerificationStats: jest
              .fn()
              .mockResolvedValue({ pending: 5, approved: 10 }),
            getVerificationDetail: jest
              .fn()
              .mockResolvedValue({ id: 'ver-1', status: 'PENDING' }),
            reviewVerification: jest
              .fn()
              .mockResolvedValue({ id: 'ver-1', status: 'APPROVED' }),
          },
        },
      ],
    })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<VerificationController>(VerificationController);
    service = module.get<VerificationService>(VerificationService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('submitVerification', () => {
    it('should delegate to verificationService.submitVerification', async () => {
      const dto = {
        type: 'ADMISSION',
        documentUrl: 'https://example.com/doc.pdf',
      } as any;
      const result = await controller.submitVerification(mockUser as any, dto);

      expect(service.submitVerification).toHaveBeenCalledWith('user-1', dto);
      expect(result).toEqual({ id: 'ver-1', status: 'PENDING' });
    });
  });

  describe('getMyVerifications', () => {
    it('should delegate to verificationService.getMyVerifications', async () => {
      const result = await controller.getMyVerifications(mockUser as any);

      expect(service.getMyVerifications).toHaveBeenCalledWith('user-1');
      expect(result).toEqual([]);
    });
  });

  describe('getPendingVerifications', () => {
    it('should pass parsed pagination to service', async () => {
      const result = await controller.getPendingVerifications('2', '10');

      expect(service.getPendingVerifications).toHaveBeenCalledWith(2, 10);
      expect(result).toEqual({ items: [], total: 0 });
    });

    it('should use defaults when no pagination provided', async () => {
      await controller.getPendingVerifications();

      expect(service.getPendingVerifications).toHaveBeenCalledWith(1, 20);
    });
  });

  describe('getVerificationStats', () => {
    it('should delegate to verificationService.getVerificationStats', async () => {
      const result = await controller.getVerificationStats();

      expect(service.getVerificationStats).toHaveBeenCalled();
      expect(result).toEqual({ pending: 5, approved: 10 });
    });
  });

  describe('getVerificationDetail', () => {
    it('should delegate to verificationService.getVerificationDetail', async () => {
      const result = await controller.getVerificationDetail('ver-1');

      expect(service.getVerificationDetail).toHaveBeenCalledWith('ver-1');
      expect(result).toEqual({ id: 'ver-1', status: 'PENDING' });
    });
  });

  describe('reviewVerification', () => {
    it('should delegate to verificationService.reviewVerification', async () => {
      const dto = { status: 'APPROVED', comment: 'Looks good' } as any;
      const result = await controller.reviewVerification(
        mockAdmin as any,
        'ver-1',
        dto,
      );

      expect(service.reviewVerification).toHaveBeenCalledWith(
        'ver-1',
        'admin-1',
        dto,
      );
      expect(result).toEqual({ id: 'ver-1', status: 'APPROVED' });
    });
  });
});
