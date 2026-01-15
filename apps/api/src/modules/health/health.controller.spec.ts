import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { PrismaService } from '../../prisma/prisma.service';
import { Response } from 'express';

describe('HealthController', () => {
  let controller: HealthController;
  let prismaService: PrismaService;
  let mockResponse: Partial<Response>;

  beforeEach(async () => {
    mockResponse = {
      status: jest.fn().mockReturnThis(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: PrismaService,
          useValue: {
            $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
          },
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  describe('check', () => {
    it('should return healthy status when database is connected', async () => {
      const result = await controller.check(mockResponse as Response);

      expect(result.status).toBe('ok');
      expect(result.timestamp).toBeDefined();
      expect(result.uptime).toBeGreaterThanOrEqual(0);
      expect(result.checks.database.status).toBe('ok');
    });

    it('should return error status when database is not connected', async () => {
      (prismaService.$queryRaw as jest.Mock).mockRejectedValue(
        new Error('DB connection failed'),
      );

      const result = await controller.check(mockResponse as Response);

      expect(result.status).toBe('error');
      expect(result.checks.database.status).toBe('error');
    });
  });

  describe('liveness', () => {
    it('should return ok status', () => {
      const result = controller.liveness();
      expect(result.status).toBe('ok');
    });
  });

  describe('readiness', () => {
    it('should return ok when database is ready', async () => {
      const result = await controller.readiness(mockResponse as Response);
      expect(result.status).toBe('ok');
    });

    it('should return error when database is not ready', async () => {
      (prismaService.$queryRaw as jest.Mock).mockRejectedValue(
        new Error('DB not ready'),
      );

      const result = await controller.readiness(mockResponse as Response);
      expect(result.status).toBe('error');
    });
  });
});
