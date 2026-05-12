import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RedisMetricsCollector } from '../common/redis/redis-metrics.service';
import { RedisService } from '../common/redis/redis.service';
import { StorageService } from '../common/storage/storage.service';
import { AuditLogService } from '../common/services/audit-log.service';
import { SchoolWriteService } from '../modules/school/school-write.service';
import { SchoolMediaService } from '../modules/school/school-media.service';
import { stringifySchoolMediaResult } from '../modules/school/school-media-output.util';

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  if (found) return found.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function getBooleanArg(name: string, defaultValue: boolean): boolean {
  const value = getArg(name);
  if (value == null) {
    return process.argv.includes(`--${name}`) ? true : defaultValue;
  }
  return ['true', '1', 'yes'].includes(value.toLowerCase());
}

function getNumberArg(name: string, defaultValue: number): number {
  const parsed = Number(getArg(name) ?? defaultValue);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

function normalizeSource(source: string): string {
  return source === 'all' ? 'official,wikimedia' : source;
}

async function main() {
  const config = new ConfigService();
  const prisma = new PrismaService();
  const metrics = new RedisMetricsCollector();
  const redis = new RedisService(config, metrics);
  const storage = new StorageService(config);
  const auditLog = new AuditLogService(prisma);
  const schoolWriteService = new SchoolWriteService(prisma, redis);
  const service = new SchoolMediaService(
    config,
    prisma,
    storage,
    schoolWriteService,
    auditLog,
  );

  try {
    await prisma.onModuleInit();
    await storage.onModuleInit();

    const limit = Math.min(Math.max(1, getNumberArg('limit', 25)), 500);
    const source = normalizeSource(getArg('source') ?? 'all');
    const schoolId = getArg('schoolId');
    const dryRun = getBooleanArg('dry-run', true);

    const result = await service.discoverMedia({
      limit,
      source,
      schoolId,
      dryRun,
    });

    console.log(stringifySchoolMediaResult(result));
  } finally {
    await prisma.onModuleDestroy();
    await redis.onModuleDestroy();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
