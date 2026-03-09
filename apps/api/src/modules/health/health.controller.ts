import { Controller, Get, HttpStatus, Res, Optional } from '@nestjs/common';
import * as os from 'os';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { SkipThrottle } from '../../common/decorators/throttle.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';

type CheckStatus = 'ok' | 'degraded' | 'error';

interface ComponentCheck {
  status: CheckStatus;
  latencyMs?: number;
  message?: string;
}

interface HealthStatus {
  status: CheckStatus;
  version: string;
  timestamp: string;
  uptime: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  checks: {
    database: ComponentCheck;
    redis?: ComponentCheck;
  };
}

interface BuildInfo {
  commitSha: string;
  buildTime: string;
  nodeVersion: string;
}

interface DetailedHealthStatus extends HealthStatus {
  env: string;
  nodeVersion: string;
  build: BuildInfo;
}

@ApiTags('Health')
@Controller('health')
@SkipThrottle()
export class HealthController {
  private readonly startTime = Date.now();

  constructor(
    private prisma: PrismaService,
    @Optional() private redisService?: RedisService,
  ) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  @ApiResponse({ status: 503, description: 'Service is unhealthy' })
  async check(
    @Res({ passthrough: true }) res: Response,
  ): Promise<HealthStatus> {
    const checks = await this.runChecks();
    const memory = this.getMemoryUsage();

    const overallStatus = this.calculateOverallStatus(checks);

    // Set appropriate status code
    if (overallStatus === 'error') {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }

    return {
      status: overallStatus,
      version: process.env.npm_package_version || '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory,
      checks,
    };
  }

  @Get('detailed')
  @Public()
  @ApiOperation({ summary: 'Detailed health check (internal use)' })
  async detailedCheck(
    @Res({ passthrough: true }) res: Response,
  ): Promise<DetailedHealthStatus> {
    const basicHealth = await this.check(res);

    return {
      ...basicHealth,
      env: process.env.NODE_ENV || 'development',
      nodeVersion: process.version,
      build: {
        commitSha:
          process.env.GIT_COMMIT_SHA ||
          process.env.RAILWAY_GIT_COMMIT_SHA ||
          'unknown',
        buildTime: process.env.BUILD_TIME || 'unknown',
        nodeVersion: process.version,
      },
    };
  }

  @Get('live')
  @Public()
  @ApiOperation({ summary: 'Liveness probe for Kubernetes' })
  liveness(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('ready')
  @Public()
  @ApiOperation({ summary: 'Readiness probe for Kubernetes' })
  async readiness(
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ status: CheckStatus; message?: string }> {
    try {
      const start = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      const latency = Date.now() - start;

      // Consider slow response as degraded
      if (latency > 1000) {
        res.status(HttpStatus.SERVICE_UNAVAILABLE);
        return {
          status: 'degraded',
          message: `Database response slow: ${latency}ms`,
        };
      }

      return { status: 'ok' };
    } catch (error) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
      return { status: 'error', message: 'Database connection failed' };
    }
  }

  @Get('startup')
  @Public()
  @ApiOperation({ summary: 'Startup probe for Kubernetes' })
  startup(): { status: 'ok'; startedAt: string } {
    return {
      status: 'ok',
      startedAt: new Date(this.startTime).toISOString(),
    };
  }

  private async runChecks(): Promise<HealthStatus['checks']> {
    const checks: HealthStatus['checks'] = {
      database: await this.checkDatabase(),
    };

    // Add Redis check if service is available
    if (this.redisService) {
      checks.redis = await this.checkRedis();
    }

    return checks;
  }

  private async checkDatabase(): Promise<ComponentCheck> {
    try {
      const start = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      const latencyMs = Date.now() - start;

      if (latencyMs > 1000) {
        return { status: 'degraded', latencyMs, message: 'Slow response' };
      }

      return { status: 'ok', latencyMs };
    } catch (error) {
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  }

  private async checkRedis(): Promise<ComponentCheck> {
    if (!this.redisService) {
      return { status: 'degraded', message: 'Redis service not configured' };
    }

    try {
      const result = await this.redisService.healthCheck();
      return {
        status: result.status === 'error' ? 'degraded' : result.status,
        latencyMs: result.latencyMs,
        message: result.message,
      };
    } catch (error) {
      return {
        status: 'degraded',
        message: error instanceof Error ? error.message : 'Redis check failed',
      };
    }
  }

  private getMemoryUsage(): HealthStatus['memory'] {
    const used = process.memoryUsage();
    const total = os.totalmem();
    const usedMB = Math.round(used.heapUsed / 1024 / 1024);
    const totalMB = Math.round(total / 1024 / 1024);

    return {
      used: usedMB,
      total: totalMB,
      percentage: Math.round((usedMB / totalMB) * 100),
    };
  }

  private calculateOverallStatus(checks: HealthStatus['checks']): CheckStatus {
    const statuses = Object.values(checks).map((c) => c.status);

    if (statuses.includes('error')) return 'error';
    if (statuses.includes('degraded')) return 'degraded';
    return 'ok';
  }
}
