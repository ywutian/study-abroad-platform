import fs from 'node:fs/promises';
import path from 'node:path';
import { BadRequestException, Injectable, Optional } from '@nestjs/common';

type DeliveryQueue = 'user_prompt' | 'operator_review' | 'system_generation';
type DeliveryStatus =
  | 'ready_for_in_app_admin_delivery'
  | 'ready_for_operator_review'
  | 'ready_for_system_generation'
  | 'blocked_missing_copy';
type DeliverySeverity = 'critical' | 'warning' | 'info';

interface DeliveryPackage {
  generatedAt: string;
  mode: string;
  sourceWorklist: string;
  policyFile: string;
  readinessVersion: string;
  privacy: {
    includesUserIds: boolean;
    recipientKeyStrategy: string;
  };
  policy: Record<string, unknown>;
  summary: Record<string, unknown>;
  rows: DeliveryRow[];
}

interface DeliveryRow {
  queue: DeliveryQueue;
  status: DeliveryStatus;
  recipientKey: string;
  campaignId: string;
  domain: string;
  action: string;
  gap: string;
  severity: DeliverySeverity;
  route: string;
  title?: string;
  content?: string;
  cta?: string;
  allowedChannels: string[];
  liveChannelsDisabled: string[];
  frequencyDedupeKey?: string;
  suppressWhen: string[];
  schoolId?: string;
  schoolName?: string;
}

interface DeliveryQuery {
  queue?: DeliveryQueue;
  status?: DeliveryStatus;
  severity?: DeliverySeverity;
  page?: number;
  pageSize?: number;
}

const DEFAULT_REPORT_DIR = path.resolve(
  process.cwd(),
  'scripts',
  'closure-reports',
);
const REPORT_PREFIX = 'profile-readiness-admin-delivery';
const GENERATE_COMMAND =
  'pnpm --filter api audit:profile-readiness-admin-delivery -- --worklist /tmp/profile-readiness-worklist.json --policy scripts/data/profile-readiness-delivery-policy.json';

@Injectable()
export class AdminProfileReadinessDeliveryService {
  // Stored as a mutable property rather than a constructor-with-default
  // because NestJS DI cannot resolve a default-valued primitive parameter
  // (causes UndefinedDependencyException at module bootstrap). Tests inject
  // an override via the optional constructor argument.
  private readonly reportDir: string;

  constructor(@Optional() reportDirOverride?: string) {
    this.reportDir = reportDirOverride ?? DEFAULT_REPORT_DIR;
  }

  async getLatestPackage(query: DeliveryQuery = {}) {
    const latest = await this.findLatestReport();
    if (!latest) {
      return {
        mode: 'read-only-admin-delivery-surface',
        reportAvailable: false,
        reportDir: this.reportDir,
        generateCommand: GENERATE_COMMAND,
        message:
          'No profile readiness admin delivery package found. Generate one before opening the admin delivery surface.',
      };
    }

    const report = await this.readPackage(latest.path);
    if (report.privacy?.includesUserIds) {
      throw new BadRequestException(
        'Latest readiness delivery package contains raw user IDs. Regenerate without --include-user-ids before using the DATA_HEALTH admin surface.',
      );
    }

    const rows = this.filterRows(report.rows, query);
    const page = this.positiveInt(query.page, 1, 1);
    const pageSize = this.positiveInt(query.pageSize, 50, 1, 200);
    const start = (page - 1) * pageSize;

    return {
      mode: 'read-only-admin-delivery-surface',
      reportAvailable: true,
      sourceReport: latest.name,
      sourceReportUpdatedAt: latest.updatedAt.toISOString(),
      generatedAt: report.generatedAt,
      readinessVersion: report.readinessVersion,
      privacy: report.privacy,
      policy: report.policy,
      summary: report.summary,
      filters: {
        queue: query.queue ?? null,
        status: query.status ?? null,
        severity: query.severity ?? null,
      },
      pagination: {
        page,
        pageSize,
        totalRows: rows.length,
        totalPages: Math.ceil(rows.length / pageSize),
      },
      rows: rows.slice(start, start + pageSize),
    };
  }

  private async findLatestReport(): Promise<{
    name: string;
    path: string;
    updatedAt: Date;
  } | null> {
    let names: string[];
    try {
      names = await fs.readdir(this.reportDir);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }

    const candidates = await Promise.all(
      names
        .filter(
          (name) => name.startsWith(REPORT_PREFIX) && name.endsWith('.json'),
        )
        .map(async (name) => {
          const reportPath = path.join(this.reportDir, name);
          const stat = await fs.stat(reportPath);
          return { name, path: reportPath, updatedAt: stat.mtime };
        }),
    );

    candidates.sort(
      (a, b) =>
        b.updatedAt.getTime() - a.updatedAt.getTime() ||
        b.name.localeCompare(a.name),
    );
    return candidates[0] ?? null;
  }

  private async readPackage(reportPath: string): Promise<DeliveryPackage> {
    const parsed = JSON.parse(
      await fs.readFile(reportPath, 'utf8'),
    ) as DeliveryPackage;
    if (!Array.isArray(parsed.rows)) {
      throw new BadRequestException(
        `Invalid profile readiness delivery package: ${path.basename(reportPath)}`,
      );
    }
    return parsed;
  }

  private filterRows(rows: DeliveryRow[], query: DeliveryQuery): DeliveryRow[] {
    return rows.filter((row) => {
      if (query.queue && row.queue !== query.queue) return false;
      if (query.status && row.status !== query.status) return false;
      if (query.severity && row.severity !== query.severity) return false;
      return true;
    });
  }

  private positiveInt(
    value: number | undefined,
    fallback: number,
    min: number,
    max = Number.MAX_SAFE_INTEGER,
  ) {
    if (!Number.isFinite(value)) return fallback;
    return Math.min(Math.max(Math.floor(value!), min), max);
  }
}
