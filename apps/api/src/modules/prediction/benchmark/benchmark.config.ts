import { existsSync } from 'fs';
import * as path from 'path';

const DEFAULT_SECRETS_SUBDIR = path.join('.secrets', 'competitor-benchmark');

export function isBenchmarkEnabled(): boolean {
  return (
    String(process.env.BENCHMARK_ENABLED ?? 'false').toLowerCase() === 'true'
  );
}

function resolveDefaultSecretsRoot(): string {
  const cwd = process.cwd();
  const monorepoApiDir = path.resolve(cwd, 'apps', 'api');
  if (existsSync(monorepoApiDir)) {
    return monorepoApiDir;
  }
  return cwd;
}

export function getBenchmarkSecretsDir(): string {
  return process.env.BENCHMARK_SECRETS_DIR
    ? path.resolve(process.env.BENCHMARK_SECRETS_DIR)
    : path.resolve(resolveDefaultSecretsRoot(), DEFAULT_SECRETS_SUBDIR);
}

export function getSessionStoragePath(sourceKey: string): string {
  const safeKey = sourceKey.replace(/[^a-z0-9_-]/gi, '-').toLowerCase();
  return path.join(getBenchmarkSecretsDir(), `${safeKey}.storageState.json`);
}

export function isPlaywrightStorageState(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const record = value as { cookies?: unknown; origins?: unknown };
  return (
    (record.cookies === undefined || Array.isArray(record.cookies)) &&
    (record.origins === undefined || Array.isArray(record.origins))
  );
}
