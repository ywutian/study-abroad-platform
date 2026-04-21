import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type { CommandResult } from './types';

export const AUDIT_DATE = '2026-04-19';
export const DEFAULT_RUN_ROOT = path.join(
  process.cwd(),
  'e2e-report',
  `system-accuracy-audit-${AUDIT_DATE}`
);
export const DEFAULT_REPORT_PATH = path.join(
  process.cwd(),
  'docs',
  `SYSTEM_ACCURACY_AUDIT_${AUDIT_DATE}.md`
);

export function loadApiEnv() {
  const envPath = path.join(process.cwd(), 'apps/api/.env');
  if (!fs.existsSync(envPath)) return;

  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    const [, key, valueRaw] = match;
    if (process.env[key] != null) continue;

    let value = valueRaw.trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

export function ensureDir(dirPath: string) {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function writeJson(filePath: string, data: unknown) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

export function writeText(filePath: string, data: string) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, data);
}

export function readText(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8');
}

export function findLineNumber(filePath: string, needle: string): number | null {
  const content = readText(filePath);
  const lines = content.split(/\r?\n/);
  const index = lines.findIndex((line) => line.includes(needle));
  return index === -1 ? null : index + 1;
}

export function runCommand(command: string, args: string[], cwd = process.cwd()): CommandResult {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: process.env,
  });

  return {
    command: [command, ...args].join(' '),
    exitCode: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

export function monthDayString(date: Date): string {
  const month = date.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
  const day = date.getUTCDate();
  return `${month} ${day}`;
}

export function normalizeWhitespace(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

export function normalizeMonthDay(value: string | null | undefined): string {
  const normalized = normalizeWhitespace(value).toLowerCase();
  return normalized
    .replace(/january/g, '1')
    .replace(/february/g, '2')
    .replace(/march/g, '3')
    .replace(/april/g, '4')
    .replace(/may/g, '5')
    .replace(/june/g, '6')
    .replace(/july/g, '7')
    .replace(/august/g, '8')
    .replace(/september/g, '9')
    .replace(/october/g, '10')
    .replace(/november/g, '11')
    .replace(/december/g, '12')
    .replace(/月/g, '/')
    .replace(/日/g, '')
    .replace(/[^0-9/ ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function asRateNumber(value: unknown): number | null {
  if (value == null) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return numeric;
}

export function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

export function currentModuleDir(importMetaUrl: string): string {
  return path.dirname(fileURLToPath(importMetaUrl));
}
