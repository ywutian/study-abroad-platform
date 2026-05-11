import 'reflect-metadata';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { ConfigService } from '@nestjs/config';
import { config as loadEnv } from 'dotenv';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisMetricsCollector } from '../src/common/redis/redis-metrics.service';
import { RedisService } from '../src/common/redis/redis.service';
import { StorageService } from '../src/common/storage/storage.service';
import { AuditLogService } from '../src/common/services/audit-log.service';
import { SchoolWriteService } from '../src/modules/school/school-write.service';
import { SchoolMediaService } from '../src/modules/school/school-media.service';

for (const envPath of [
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), 'apps/api/.env'),
]) {
  if (existsSync(envPath)) loadEnv({ path: envPath, override: false });
}

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
  return value === 'true' || value === '1' || value === 'yes';
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

    const limit = Number(getArg('limit') ?? '243');
    const source = getArg('source') ?? 'official,wikimedia';
    const schoolId = getArg('schoolId');
    const dryRun = getBooleanArg('dry-run', true);

    const result = await service.discoverMedia({
      limit,
      source,
      schoolId,
      dryRun,
    });

    console.log(JSON.stringify(result, null, 2));
  } finally {
    await prisma.onModuleDestroy();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
