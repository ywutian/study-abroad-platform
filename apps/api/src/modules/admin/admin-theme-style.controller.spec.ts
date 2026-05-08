import { BadRequestException, ConflictException } from '@nestjs/common';
import { AdminThemeStyleController } from './admin-theme-style.controller';
import {
  AuditAction,
  AuditLogService,
} from '../../common/services/audit-log.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { CurrentUserPayload } from '../../common/decorators';

describe('AdminThemeStyleController', () => {
  const admin: CurrentUserPayload = {
    id: 'admin-1',
    email: 'admin@example.com',
    role: 'ADMIN',
    locale: 'en',
  };
  const otherAdmin: CurrentUserPayload = {
    id: 'admin-2',
    email: 'design@example.com',
    role: 'ADMIN',
    locale: 'en',
  };

  let storedValue: string | null;
  let updatedAt: Date;
  let controller: AdminThemeStyleController;
  let prisma: {
    systemSetting: {
      findUnique: jest.Mock;
      create: jest.Mock;
      updateMany: jest.Mock;
    };
    auditLog: {
      findMany: jest.Mock;
    };
  };
  let auditLog: { log: jest.Mock };

  beforeEach(() => {
    storedValue = null;
    updatedAt = new Date('2026-05-01T12:00:00.000Z');
    prisma = {
      systemSetting: {
        findUnique: jest.fn(async () =>
          storedValue
            ? {
                key: 'admin.themeStyleLibrary.v1',
                value: storedValue,
                updatedAt,
              }
            : null,
        ),
        create: jest.fn(async ({ data }) => {
          storedValue = data.value;
          updatedAt = new Date(updatedAt.getTime() + 1000);
          return { ...data, updatedAt };
        }),
        updateMany: jest.fn(async ({ data }) => {
          storedValue = data.value;
          updatedAt = new Date(updatedAt.getTime() + 1000);
          return { count: 1 };
        }),
      },
      auditLog: {
        findMany: jest.fn(async () => []),
      },
    };
    auditLog = { log: jest.fn(async () => undefined) };
    controller = new AdminThemeStyleController(
      prisma as unknown as PrismaService,
      auditLog as unknown as AuditLogService,
    );
  });

  const saveInput = {
    palette: 'cobalt-saas',
    heroVisual: 'command-center',
    appearanceOverrides: {
      clarity: 72,
      frost: 15,
      glow: 12,
      texture: 10,
      contrast: 58,
      saturation: 46,
      colorPresence: 38,
    },
    sourcePath: '/zh/settings',
    clientRequestId: 'request-1',
  };

  it('returns an empty diagnostics envelope when no library exists', async () => {
    const response = await controller.listThemeStyles();

    expect(response.revision).toBe(0);
    expect(response.items).toEqual([]);
    expect(response.diagnostics.parseStatus).toBe('ok');
  });

  it('validates unknown palette and hero without saving', async () => {
    const response = await controller.validateThemeStyle(admin, {
      palette: 'missing-palette',
      heroVisual: 'missing-hero',
      appearanceOverrides: { clarity: 200 },
    });

    expect(response.valid).toBe(false);
    expect(response.issues.map((issue) => issue.code)).toEqual([
      'INVALID_PALETTE',
      'INVALID_HERO_VISUAL',
    ]);
    expect(auditLog.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.THEME_STYLE_VALIDATE_FAILED,
      }),
    );
  });

  it('returns enterprise certification matrix for every theme combination', async () => {
    const response = await controller.getCertificationMatrix();

    expect(response.defaultPalette).toBe('cobalt-saas');
    expect(response.defaultHeroVisual).toBe('command-center');
    expect(response.total).toBe(response.matrix.length);
    expect(response.failed).toBe(0);
    expect(response.diagnostics.buttonVariantCount).toBe(8);
    expect(response.matrix.some((entry) => entry.isDefault)).toBe(true);
  });

  it('certifies a single theme style without saving it', async () => {
    const certification = await controller.certifyThemeStyle({
      palette: 'cobalt-saas',
      heroVisual: 'command-center',
      appearanceOverrides: {},
    });

    expect(certification.palette).toBe('cobalt-saas');
    expect(certification.heroVisual).toBe('command-center');
    expect(certification.status).toBe('passed');
    expect(certification.buttonSurfaceAudit).toHaveLength(16);
    expect(
      certification.contrastSummary.minimumTextContrast,
    ).toBeGreaterThanOrEqual(4.5);
    expect(await controller.listThemeStyles()).toMatchObject({
      revision: 0,
      items: [],
    });
  });

  it('saves a new style with revision, checksum, metadata and audit log', async () => {
    const item = await controller.saveThemeStyle(admin, saveInput);
    const response = await controller.listThemeStyles();

    expect(item?.palette).toBe('cobalt-saas');
    expect(item?.heroVisual).toBe('command-center');
    expect(item?.sourcePath).toBe('/zh/settings');
    expect(item?.certificationStatus).toBeDefined();
    expect(item?.certificationResult?.routeAuditSummary.length).toBeGreaterThan(
      0,
    );
    expect(item?.certificationResult?.buttonSurfaceAudit.length).toBe(16);
    expect(response.revision).toBe(1);
    expect(response.checksum).toHaveLength(24);
    expect(response.items).toHaveLength(1);
    expect(prisma.systemSetting.create).toHaveBeenCalledTimes(1);
    expect(auditLog.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.THEME_STYLE_SAVE,
        resourceId: item?.id,
        metadata: expect.objectContaining({
          beforeRevision: 0,
          afterRevision: 1,
          clientRequestId: 'request-1',
        }),
      }),
    );
  });

  it('dedupes by signature and increments voteCount for another admin', async () => {
    await controller.saveThemeStyle(admin, saveInput);
    const response = await controller.listThemeStyles();
    const item = await controller.saveThemeStyle(otherAdmin, {
      ...saveInput,
      expectedRevision: response.revision,
      clientRequestId: 'request-2',
    });

    expect(item?.voteCount).toBe(2);
    expect(item?.savedBy.map((entry) => entry.email)).toEqual([
      'design@example.com',
      'admin@example.com',
    ]);
    expect((await controller.listThemeStyles()).items).toHaveLength(1);
  });

  it('rejects revision conflicts', async () => {
    await controller.saveThemeStyle(admin, saveInput);

    await expect(
      controller.saveThemeStyle(admin, {
        ...saveInput,
        expectedRevision: 0,
        clientRequestId: 'stale-request',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('marks a style verified and clears validation errors', async () => {
    const item = await controller.saveThemeStyle(admin, saveInput);
    const response = await controller.listThemeStyles();
    const verified = await controller.patchThemeStyle(admin, item!.id, {
      expectedRevision: response.revision,
      status: 'verified',
      validationStatus: 'passed',
      validationErrors: [],
    });

    expect(verified?.status).toBe('verified');
    expect(verified?.validationStatus).toBe('passed');
    expect(verified?.certificationStatus).toBe('passed');
    expect(verified?.verifiedAt).toBeDefined();
    expect(verified?.validationErrors).toEqual([]);
    expect(auditLog.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: AuditAction.THEME_STYLE_UPDATE }),
    );
  });

  it('rejects invalid save payloads', async () => {
    await expect(
      controller.saveThemeStyle(admin, {
        palette: 'not-real',
        heroVisual: 'also-not-real',
        appearanceOverrides: {},
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
