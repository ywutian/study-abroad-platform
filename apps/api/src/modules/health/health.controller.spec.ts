import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { PrismaService } from '../../prisma/prisma.service';
import { Response } from 'express';
import { RedisService } from '../../common/redis/redis.service';

describe('HealthController', () => {
  let controller: HealthController;
  let prismaService: PrismaService;
  let redisService: {
    healthCheck: jest.Mock;
    getRuntimeState: jest.Mock;
  };
  let mockResponse: Partial<Response>;

  beforeEach(async () => {
    mockResponse = {
      status: jest.fn().mockReturnThis(),
    };
    redisService = {
      healthCheck: jest.fn().mockResolvedValue({ status: 'ok', latencyMs: 1 }),
      getRuntimeState: jest.fn().mockReturnValue({
        configured: true,
        connected: true,
        activeEndpoint: 'url:1',
        circuitOpen: false,
        circuitOpenUntil: null,
        circuitReason: null,
        circuitMessage: null,
        endpointCount: 3,
        availableEndpointCount: 2,
        endpoints: [
          {
            label: 'url:1',
            active: true,
            circuitOpen: false,
            circuitOpenUntil: null,
            circuitReason: null,
            circuitMessage: null,
          },
          {
            label: 'url:2',
            active: false,
            circuitOpen: true,
            circuitOpenUntil: '2026-05-14T03:00:00.000Z',
            circuitReason: 'quota_exceeded',
            circuitMessage: 'ERR max requests limit exceeded',
          },
          {
            label: 'url:3',
            active: false,
            circuitOpen: false,
            circuitOpenUntil: null,
            circuitReason: null,
            circuitMessage: null,
          },
        ],
        lastErrorAt: null,
        lastErrorKind: null,
        lastErrorMessage: null,
        lastConnectedAt: '2026-05-14T02:00:00.000Z',
        lastReconnectAttemptAt: null,
        nextReconnectAt: null,
        reconnectAttempts: 0,
      }),
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
        {
          provide: RedisService,
          useValue: redisService,
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
      expect(result.checks.redis?.status).toBe('ok');
    });

    it('should report degraded when optional Redis is degraded', async () => {
      redisService.healthCheck.mockResolvedValue({
        status: 'error',
        message: 'ERR max requests limit exceeded',
      });

      const result = await controller.check(mockResponse as Response);

      expect(result.status).toBe('degraded');
      expect(result.checks.database.status).toBe('ok');
      expect(result.checks.redis?.status).toBe('degraded');
      expect(result.checks.redis?.message).toBe(
        'ERR max requests limit exceeded',
      );
      expect(mockResponse.status).not.toHaveBeenCalled();
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

    it('should not fail readiness when optional Redis is degraded', async () => {
      redisService.healthCheck.mockResolvedValue({
        status: 'error',
        message: 'Redis not connected',
      });

      const result = await controller.readiness(mockResponse as Response);

      expect(result.status).toBe('ok');
      expect(redisService.healthCheck).not.toHaveBeenCalled();
    });

    it('should return error when database is not ready', async () => {
      (prismaService.$queryRaw as jest.Mock).mockRejectedValue(
        new Error('DB not ready'),
      );

      const result = await controller.readiness(mockResponse as Response);
      expect(result.status).toBe('error');
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // 2026-05: /health/detailed must expose per-endpoint Redis state so
  // operators can answer "which of my N Redis is active, which tripped?"
  // ───────────────────────────────────────────────────────────────────────

  describe('detailedCheck — redisRuntime contract', () => {
    it('includes redisRuntime with per-endpoint detail when Redis is configured', async () => {
      const result = await controller.detailedCheck(mockResponse as Response);

      expect(result.redisRuntime).toBeDefined();
      expect(result.redisRuntime?.configured).toBe(true);
      expect(result.redisRuntime?.endpointCount).toBe(3);
      expect(result.redisRuntime?.availableEndpointCount).toBe(2);
      expect(result.redisRuntime?.activeEndpoint).toBe('url:1');
      expect(result.redisRuntime?.circuitOpen).toBe(false);

      // Per-endpoint detail is the headline feature of this endpoint.
      expect(result.redisRuntime?.endpoints).toHaveLength(3);
      expect(result.redisRuntime?.endpoints[0]).toMatchObject({
        label: 'url:1',
        active: true,
        circuitOpen: false,
      });
      expect(result.redisRuntime?.endpoints[1]).toMatchObject({
        label: 'url:2',
        active: false,
        circuitOpen: true,
        circuitReason: 'quota_exceeded',
      });
    });

    it('omits redisRuntime when Redis is not configured', async () => {
      redisService.getRuntimeState.mockReturnValue({
        configured: false,
        connected: false,
        activeEndpoint: null,
        circuitOpen: false,
        circuitOpenUntil: null,
        circuitReason: null,
        circuitMessage: null,
        endpointCount: 0,
        availableEndpointCount: 0,
        endpoints: [],
        lastErrorAt: null,
        lastErrorKind: null,
        lastErrorMessage: null,
        lastConnectedAt: null,
        lastReconnectAttemptAt: null,
        nextReconnectAt: null,
        reconnectAttempts: 0,
      });

      const result = await controller.detailedCheck(mockResponse as Response);
      expect(result.redisRuntime).toBeUndefined();
    });
  });
});
