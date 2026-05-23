import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { BadRequestException } from '@nestjs/common';
import { AdminProfileReadinessDeliveryService } from './admin-profile-readiness-delivery.service';

describe('AdminProfileReadinessDeliveryService', () => {
  let reportDir: string;
  let service: AdminProfileReadinessDeliveryService;

  beforeEach(() => {
    reportDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'profile-readiness-delivery-'),
    );
    service = new AdminProfileReadinessDeliveryService(reportDir);
  });

  afterEach(() => {
    fs.rmSync(reportDir, { recursive: true, force: true });
  });

  it('returns an actionable empty state when no package has been generated', async () => {
    const result = await service.getLatestPackage();

    expect(result).toEqual(
      expect.objectContaining({
        mode: 'read-only-admin-delivery-surface',
        reportAvailable: false,
        reportDir,
      }),
    );
    expect(result.generateCommand).toContain(
      'audit:profile-readiness-admin-delivery',
    );
  });

  it('loads the latest anonymized package with filtering and pagination', async () => {
    writePackage('profile-readiness-admin-delivery-old.json', {
      generatedAt: '2026-05-20T16:00:00.000Z',
      rows: [deliveryRow({ recipientKey: 'old-recipient' })],
    });
    writePackage('profile-readiness-admin-delivery-new.json', {
      generatedAt: '2026-05-20T17:00:00.000Z',
      rows: [
        deliveryRow({
          recipientKey: 'recipient-a',
          gap: 'school_list.min_count',
          severity: 'critical',
        }),
        deliveryRow({
          recipientKey: 'recipient-b',
          gap: 'profile.activities',
          severity: 'warning',
        }),
        deliveryRow({
          recipientKey: 'recipient-c',
          queue: 'operator_review',
          status: 'ready_for_operator_review',
          gap: 'school_deadline.source_review',
          severity: 'warning',
        }),
      ],
    });

    const result = await service.getLatestPackage({
      queue: 'user_prompt',
      severity: 'warning',
      page: 1,
      pageSize: 1,
    });

    expect(result).toEqual(
      expect.objectContaining({
        reportAvailable: true,
        sourceReport: 'profile-readiness-admin-delivery-new.json',
        generatedAt: '2026-05-20T17:00:00.000Z',
        privacy: expect.objectContaining({ includesUserIds: false }),
      }),
    );
    expect(result.pagination).toEqual({
      page: 1,
      pageSize: 1,
      totalRows: 1,
      totalPages: 1,
    });
    expect(result.rows).toEqual([
      expect.objectContaining({
        recipientKey: 'recipient-b',
        queue: 'user_prompt',
        severity: 'warning',
      }),
    ]);
  });

  it('rejects packages that expose raw user IDs', async () => {
    writePackage('profile-readiness-admin-delivery-raw.json', {
      privacy: {
        includesUserIds: true,
        recipientKeyStrategy: 'raw-user-id',
      },
      rows: [deliveryRow({ recipientKey: 'user-123' })],
    });

    await expect(service.getLatestPackage()).rejects.toThrow(
      BadRequestException,
    );
  });

  function writePackage(
    name: string,
    overrides: DeliveryPackageFixtureOverrides,
  ) {
    fs.writeFileSync(
      path.join(reportDir, name),
      `${JSON.stringify(packageFixture(overrides), null, 2)}\n`,
    );
    const stamp = name.includes('old')
      ? new Date('2026-05-20T16:00:00.000Z')
      : new Date('2026-05-20T17:00:00.000Z');
    fs.utimesSync(path.join(reportDir, name), stamp, stamp);
  }
});

interface DeliveryPackageFixtureOverrides {
  generatedAt?: string;
  privacy?: { includesUserIds: boolean; recipientKeyStrategy: string };
  rows?: ReturnType<typeof deliveryRow>[];
}

function packageFixture(overrides: DeliveryPackageFixtureOverrides = {}) {
  return {
    generatedAt: '2026-05-20T17:00:00.000Z',
    mode: 'read-only-admin-delivery-package',
    sourceWorklist: '/tmp/profile-readiness-worklist.json',
    policyFile: 'scripts/data/profile-readiness-delivery-policy.json',
    readinessVersion: 'profile-readiness-v1',
    privacy: {
      includesUserIds: false,
      recipientKeyStrategy: 'sha256(report-salted-user-id)',
    },
    policy: { policyVersion: 'profile-readiness-delivery-v1' },
    summary: { openRows: overrides.rows?.length ?? 1 },
    rows: [deliveryRow()],
    ...overrides,
  };
}

function deliveryRow(
  overrides: Partial<{
    queue: 'user_prompt' | 'operator_review' | 'system_generation';
    status:
      | 'ready_for_in_app_admin_delivery'
      | 'ready_for_operator_review'
      | 'ready_for_system_generation'
      | 'blocked_missing_copy';
    recipientKey: string;
    campaignId: string;
    domain: string;
    action: string;
    gap: string;
    severity: 'critical' | 'warning' | 'info';
  }> = {},
) {
  return {
    queue: 'user_prompt' as const,
    status: 'ready_for_in_app_admin_delivery' as const,
    recipientKey: 'recipient-a',
    campaignId: 'profile-prompt-user-profile-gpa-anchor',
    domain: 'profile',
    action: 'prompt-user',
    gap: 'profile.gpa_anchor',
    severity: 'critical' as const,
    route: '/profile',
    title: 'Complete your profile',
    content: 'Add the missing profile signal.',
    cta: 'Update profile',
    allowedChannels: ['in_app_admin_delivery'],
    liveChannelsDisabled: ['redis_notification_feed', 'remote_push', 'email'],
    frequencyDedupeKey: 'profile-readiness:recipient-a:gpa',
    suppressWhen: ['gap_resolved'],
    ...overrides,
  };
}
