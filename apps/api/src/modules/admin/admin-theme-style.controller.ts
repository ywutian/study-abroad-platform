import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createHash } from 'crypto';
import { Role } from '@prisma/client';
import {
  COLOR_PALETTES,
  HERO_VISUAL_IDS,
  buildThemeCertificationMatrix,
  certifyEnterpriseTheme,
  getColorThemeDescription,
  getColorThemeLabel,
  getHeroVisualDefinition,
  getThemeStyleMeta,
  normalizeThemeAppearanceOverrides,
  parseColorPalette,
  parseHeroVisualId,
  type ColorPalette,
  type EnterpriseThemeIssue,
  type HeroVisualId,
  type ThemeAppearanceOverrides,
  type ThemeStyleActor,
  type ThemeCertificationStatus,
  type ThemeStyleDiagnostics,
  type ThemeRouteAuditResult,
  type ThemeStyleCertifyInput,
  type ThemeStyleLibraryItem,
  type ThemeStyleLibraryResponse,
  type ThemeStylePatchInput,
  type ThemeStyleRollbackInput,
  type ThemeStyleSaveInput,
  type ThemeStyleStatus,
  type ThemeStyleTombstone,
  type ThemeStyleValidateInput,
  type ThemeStyleValidateResponse,
  type ThemeStyleValidationIssue,
  type ThemeStyleValidationStatus,
} from '@study-abroad/shared';
import {
  generateDefaultThemeStyleItems,
  SYSTEM_SEED_ACTOR,
} from './theme-style-defaults';
import {
  CurrentUser,
  Roles,
  type CurrentUserPayload,
} from '../../common/decorators';
import { ThrottleRelaxed } from '../../common/decorators/throttle.decorator';
import {
  AuditAction,
  AuditLogService,
} from '../../common/services/audit-log.service';
import { PrismaService } from '../../prisma/prisma.service';

const THEME_STYLE_SETTING_KEY = 'admin.themeStyleLibrary.v1';
const THEME_STYLE_SCHEMA_VERSION = 2 as const;
// Cap fits the full 16 palette-category × 9 hero-variant seed (144) plus headroom
// for hand-curated additions. JSON size floor (MAX_THEME_STYLE_JSON_BYTES) caps the
// upper bound — at ~1.2 KB per item we have margin up to ~250 items.
const MAX_THEME_STYLE_ITEMS = 200;
const MAX_THEME_STYLE_JSON_BYTES = 300_000;

type ThemeStyleLibraryState = {
  schemaVersion: 2;
  revision: number;
  checksum: string;
  updatedAt: string | null;
  updatedBy: ThemeStyleActor | null;
  items: ThemeStyleLibraryItem[];
  tombstones: ThemeStyleTombstone[];
};

type ReadResult = {
  state: ThemeStyleLibraryState;
  diagnostics: ThemeStyleDiagnostics;
};

type NormalizedStyleInput = {
  palette?: ColorPalette;
  heroVisual?: HeroVisualId;
  appearanceOverrides: ThemeAppearanceOverrides;
  issues: ThemeStyleValidationIssue[];
};

const allowedStatuses: ThemeStyleStatus[] = [
  'draft',
  'approved',
  'active',
  'archived',
  'verified',
];
const allowedValidationStatuses: ThemeStyleValidationStatus[] = [
  'unknown',
  'passed',
  'warning',
  'failed',
];
const allowedCertificationStatuses: ThemeCertificationStatus[] = [
  'passed',
  'warning',
  'failed',
];

function actorFromUser(user: CurrentUserPayload): ThemeStyleActor {
  return { userId: user.id, email: user.email };
}

function error(
  ExceptionClass:
    | typeof BadRequestException
    | typeof ConflictException
    | typeof UnprocessableEntityException,
  code: string,
  message: string,
) {
  return new ExceptionClass({ code, message });
}

function makeSignature(input: {
  palette: ColorPalette;
  heroVisual: HeroVisualId;
  appearanceOverrides: ThemeAppearanceOverrides;
}) {
  return createHash('sha256')
    .update(JSON.stringify(input))
    .digest('hex')
    .slice(0, 16);
}

function normalizeSourcePath(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, 240);
}

function normalizeShortText(
  value: unknown,
  maxLength = 500,
): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLength);
}

function normalizeStringList(value: unknown, maxItems = 8): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, maxItems)
    .map((item) => item.slice(0, 48));
}

function normalizeValidationIssues(
  value: unknown,
): ThemeStyleValidationIssue[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((issue) => {
      if (!issue || typeof issue !== 'object') return null;
      const source = issue as Record<string, unknown>;
      const code = normalizeShortText(source.code, 80);
      const message = normalizeShortText(source.message, 240);
      const severity =
        source.severity === 'error' || source.severity === 'warning'
          ? source.severity
          : 'info';
      if (!code || !message) return null;
      return { code, message, severity } satisfies ThemeStyleValidationIssue;
    })
    .filter((issue): issue is ThemeStyleValidationIssue => Boolean(issue))
    .slice(0, 12);
}

function normalizeEnterpriseIssues(value: unknown): EnterpriseThemeIssue[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((issue) => {
      if (!issue || typeof issue !== 'object') return null;
      const source = issue as Record<string, unknown>;
      const code = normalizeShortText(source.code, 80);
      const message = normalizeShortText(source.message, 240);
      const severity =
        source.severity === 'error' || source.severity === 'warning'
          ? source.severity
          : 'info';
      const scope =
        source.scope === 'token' ||
        source.scope === 'contrast' ||
        source.scope === 'layout' ||
        source.scope === 'route' ||
        source.scope === 'component' ||
        source.scope === 'metadata'
          ? source.scope
          : 'metadata';
      if (!code || !message) return null;
      const route = normalizeShortText(source.route, 120);
      const normalized: EnterpriseThemeIssue = {
        code,
        message,
        severity,
        scope,
      };
      if (route) normalized.route = route;
      return normalized;
    })
    .filter((issue): issue is EnterpriseThemeIssue => Boolean(issue))
    .slice(0, 24);
}

function normalizeRouteAuditSummary(value: unknown): ThemeRouteAuditResult[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const source = entry as Record<string, unknown>;
      const route = normalizeShortText(source.route, 120);
      const role =
        source.role === 'admin' ||
        source.role === 'user' ||
        source.role === 'guest'
          ? source.role
          : 'user';
      const status =
        source.status === 'covered' ||
        source.status === 'not-run' ||
        source.status === 'passed' ||
        source.status === 'warning' ||
        source.status === 'failed'
          ? source.status
          : 'not-run';
      if (!route) return null;
      const viewportCoverage = Array.isArray(source.viewportCoverage)
        ? source.viewportCoverage.filter(
            (viewport): viewport is 'desktop' | 'mobile' | 'wide' =>
              viewport === 'desktop' ||
              viewport === 'mobile' ||
              viewport === 'wide',
          )
        : [];
      const issues = normalizeEnterpriseIssues(source.issues);
      return {
        route,
        role,
        status,
        viewportCoverage,
        issueCount:
          typeof source.issueCount === 'number' &&
          Number.isFinite(source.issueCount)
            ? Math.max(0, Math.min(999, Math.round(source.issueCount)))
            : issues.length,
        issues,
      } satisfies ThemeRouteAuditResult;
    })
    .filter((entry): entry is ThemeRouteAuditResult => Boolean(entry))
    .slice(0, 60);
}

function checksumState(
  state: Omit<ThemeStyleLibraryState, 'checksum'> & { checksum?: string },
) {
  const { checksum: _checksum, ...withoutChecksum } = state;
  return createHash('sha256')
    .update(JSON.stringify(withoutChecksum))
    .digest('hex')
    .slice(0, 24);
}

function withChecksum(
  state: Omit<ThemeStyleLibraryState, 'checksum'>,
): ThemeStyleLibraryState {
  const next = { ...state, checksum: '' };
  return { ...next, checksum: checksumState(next) };
}

function emptyDiagnostics(
  overrides?: Partial<ThemeStyleDiagnostics>,
): ThemeStyleDiagnostics {
  return {
    parseStatus: 'ok',
    checksumStatus: 'ok',
    itemCount: 0,
    discardedItemCount: 0,
    duplicateSignatureCount: 0,
    unknownPaletteCount: 0,
    unknownHeroVisualCount: 0,
    issues: [],
    ...overrides,
  };
}

function normalizeStyleInput(
  input: ThemeStyleValidateInput,
): NormalizedStyleInput {
  const issues: ThemeStyleValidationIssue[] = [];
  let palette: ColorPalette | undefined;
  let heroVisual: HeroVisualId | undefined;

  if (
    !input.palette ||
    !COLOR_PALETTES.includes(input.palette as ColorPalette)
  ) {
    issues.push({
      code: 'INVALID_PALETTE',
      message: 'Unknown or missing color palette.',
      severity: 'error',
    });
  } else {
    palette = parseColorPalette(input.palette);
  }

  if (
    !input.heroVisual ||
    !HERO_VISUAL_IDS.includes(input.heroVisual as HeroVisualId)
  ) {
    issues.push({
      code: 'INVALID_HERO_VISUAL',
      message: 'Unknown or missing hero visual.',
      severity: 'error',
    });
  } else {
    heroVisual = parseHeroVisualId(input.heroVisual);
  }

  const appearanceOverrides = normalizeThemeAppearanceOverrides(
    input.appearanceOverrides,
  );

  return { palette, heroVisual, appearanceOverrides, issues };
}

function normalizeLegacyItem(
  value: unknown,
  fallbackActor: ThemeStyleActor,
  fallbackRevision: number,
): { item?: ThemeStyleLibraryItem; issues: ThemeStyleValidationIssue[] } {
  const issues: ThemeStyleValidationIssue[] = [];
  if (!value || typeof value !== 'object') {
    return {
      issues: [
        {
          code: 'INVALID_ITEM',
          message: 'Discarded a non-object theme style item.',
          severity: 'warning',
        },
      ],
    };
  }

  const source = value as Partial<ThemeStyleLibraryItem> &
    Record<string, unknown>;
  if (!source.palette || !COLOR_PALETTES.includes(source.palette)) {
    issues.push({
      code: 'UNKNOWN_PALETTE',
      message: 'Discarded a theme style item with an unknown palette.',
      severity: 'warning',
    });
    return { issues };
  }
  if (!source.heroVisual || !HERO_VISUAL_IDS.includes(source.heroVisual)) {
    issues.push({
      code: 'UNKNOWN_HERO_VISUAL',
      message: 'Discarded a theme style item with an unknown hero visual.',
      severity: 'warning',
    });
    return { issues };
  }

  const palette = parseColorPalette(source.palette);
  const heroVisual = parseHeroVisualId(source.heroVisual);
  const appearanceOverrides = normalizeThemeAppearanceOverrides(
    source.appearanceOverrides,
  );
  const createdAt =
    typeof source.createdAt === 'string'
      ? source.createdAt
      : new Date(0).toISOString();
  const updatedAt =
    typeof source.updatedAt === 'string' ? source.updatedAt : createdAt;
  const styleMeta = getThemeStyleMeta(palette, appearanceOverrides);
  const routeAuditSummary = normalizeRouteAuditSummary(
    source.routeAuditSummary,
  );
  const sourceCertification =
    source.certificationResult && typeof source.certificationResult === 'object'
      ? (source.certificationResult as unknown as Record<string, unknown>)
      : undefined;
  const certificationResult = certifyEnterpriseTheme({
    palette,
    heroVisual,
    appearanceOverrides,
    routeAuditSummary,
    certifiedAt:
      typeof sourceCertification?.certifiedAt === 'string'
        ? sourceCertification.certifiedAt
        : updatedAt,
  });
  const heroVisualDefinition = getHeroVisualDefinition(heroVisual);
  const signature =
    typeof source.signature === 'string'
      ? source.signature
      : makeSignature({ palette, heroVisual, appearanceOverrides });
  const savedBy = Array.isArray(source.savedBy)
    ? source.savedBy
        .filter((entry): entry is ThemeStyleLibraryItem['savedBy'][number] => {
          return Boolean(
            entry &&
            typeof entry === 'object' &&
            typeof entry.userId === 'string' &&
            typeof entry.email === 'string' &&
            typeof entry.savedAt === 'string',
          );
        })
        .slice(0, 24)
    : [];
  const actor =
    source.updatedBy &&
    typeof source.updatedBy === 'object' &&
    typeof source.updatedBy.userId === 'string' &&
    typeof source.updatedBy.email === 'string'
      ? source.updatedBy
      : savedBy[0]
        ? { userId: savedBy[0].userId, email: savedBy[0].email }
        : fallbackActor;

  return {
    item: {
      id:
        typeof source.id === 'string' && source.id
          ? source.id
          : `theme-style-${signature}`,
      signature,
      palette,
      paletteLabelZh: getColorThemeLabel(palette, 'zh'),
      paletteLabelEn: getColorThemeLabel(palette, 'en'),
      paletteDescriptionZh: getColorThemeDescription(palette, 'zh'),
      paletteDescriptionEn: getColorThemeDescription(palette, 'en'),
      heroVisual,
      heroVisualLabelZh: heroVisualDefinition.labelZh,
      heroVisualLabelEn: heroVisualDefinition.labelEn,
      heroVisualDescriptionZh: heroVisualDefinition.descriptionZh,
      heroVisualDescriptionEn: heroVisualDefinition.descriptionEn,
      appearanceOverrides,
      styleMeta,
      status: allowedStatuses.includes(source.status as ThemeStyleStatus)
        ? (source.status as ThemeStyleStatus)
        : 'draft',
      validationStatus: allowedValidationStatuses.includes(
        source.validationStatus as ThemeStyleValidationStatus,
      )
        ? (source.validationStatus as ThemeStyleValidationStatus)
        : 'unknown',
      validationErrors: normalizeValidationIssues(source.validationErrors),
      certificationStatus: allowedCertificationStatuses.includes(
        source.certificationStatus as ThemeCertificationStatus,
      )
        ? (source.certificationStatus as ThemeCertificationStatus)
        : certificationResult.status,
      certificationResult,
      routeAuditSummary: certificationResult.routeAuditSummary,
      verifiedAt: normalizeShortText(source.verifiedAt, 80),
      notes: normalizeShortText(source.notes),
      debugTags: normalizeStringList(source.debugTags),
      sourcePath: normalizeSourcePath(source.sourcePath),
      sourceCommit: normalizeShortText(source.sourceCommit, 80),
      voteCount:
        typeof source.voteCount === 'number' &&
        Number.isFinite(source.voteCount)
          ? Math.max(source.voteCount, savedBy.length)
          : savedBy.length,
      savedBy,
      createdBy:
        source.createdBy &&
        typeof source.createdBy === 'object' &&
        typeof source.createdBy.userId === 'string' &&
        typeof source.createdBy.email === 'string'
          ? source.createdBy
          : actor,
      updatedBy: actor,
      lastAction:
        source.lastAction === 'verified' ||
        source.lastAction === 'archived' ||
        source.lastAction === 'rollback' ||
        source.lastAction === 'updated'
          ? source.lastAction
          : 'saved',
      revisionCreated:
        typeof source.revisionCreated === 'number'
          ? source.revisionCreated
          : fallbackRevision,
      revisionUpdated:
        typeof source.revisionUpdated === 'number'
          ? source.revisionUpdated
          : fallbackRevision,
      createdAt,
      updatedAt,
    },
    issues,
  };
}

function readLibrary(value?: string | null): ReadResult {
  const fallbackActor = { userId: 'system', email: 'system@local' };
  if (!value) {
    const state = withChecksum({
      schemaVersion: THEME_STYLE_SCHEMA_VERSION,
      revision: 0,
      updatedAt: null,
      updatedBy: null,
      items: [],
      tombstones: [],
    });
    return { state, diagnostics: emptyDiagnostics() };
  }

  try {
    const parsed = JSON.parse(value) as Partial<ThemeStyleLibraryState> & {
      version?: number;
      items?: unknown[];
    };
    const parseStatus = parsed.schemaVersion === 2 ? 'ok' : 'migrated';
    const seenSignatures = new Set<string>();
    const items: ThemeStyleLibraryItem[] = [];
    const issues: ThemeStyleValidationIssue[] = [];
    let discardedItemCount = 0;
    let duplicateSignatureCount = 0;
    let unknownPaletteCount = 0;
    let unknownHeroVisualCount = 0;

    for (const sourceItem of Array.isArray(parsed.items) ? parsed.items : []) {
      const normalized = normalizeLegacyItem(
        sourceItem,
        fallbackActor,
        parsed.revision ?? 0,
      );
      issues.push(...normalized.issues);
      if (!normalized.item) {
        discardedItemCount += 1;
        if (
          normalized.issues.some((issue) => issue.code === 'UNKNOWN_PALETTE')
        ) {
          unknownPaletteCount += 1;
        }
        if (
          normalized.issues.some(
            (issue) => issue.code === 'UNKNOWN_HERO_VISUAL',
          )
        ) {
          unknownHeroVisualCount += 1;
        }
        continue;
      }
      if (seenSignatures.has(normalized.item.signature)) {
        duplicateSignatureCount += 1;
        continue;
      }
      seenSignatures.add(normalized.item.signature);
      items.push(normalized.item);
    }

    const withoutChecksum = {
      schemaVersion: THEME_STYLE_SCHEMA_VERSION,
      revision: typeof parsed.revision === 'number' ? parsed.revision : 0,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null,
      updatedBy:
        parsed.updatedBy &&
        typeof parsed.updatedBy === 'object' &&
        typeof parsed.updatedBy.userId === 'string' &&
        typeof parsed.updatedBy.email === 'string'
          ? parsed.updatedBy
          : null,
      items: items
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, MAX_THEME_STYLE_ITEMS),
      tombstones: Array.isArray(parsed.tombstones)
        ? parsed.tombstones.filter((item): item is ThemeStyleTombstone => {
            return Boolean(
              item &&
              typeof item === 'object' &&
              typeof item.id === 'string' &&
              typeof item.deletedAt === 'string' &&
              typeof item.deletedBy === 'string',
            );
          })
        : [],
    };
    const state = withChecksum(withoutChecksum);
    const checksumStatus =
      typeof parsed.checksum !== 'string'
        ? 'missing'
        : parsed.checksum === state.checksum
          ? 'ok'
          : 'mismatch';

    return {
      state:
        parsed.schemaVersion === 2
          ? { ...state, checksum: parsed.checksum ?? state.checksum }
          : state,
      diagnostics: emptyDiagnostics({
        parseStatus,
        checksumStatus,
        itemCount: items.length,
        discardedItemCount,
        duplicateSignatureCount,
        unknownPaletteCount,
        unknownHeroVisualCount,
        issues,
      }),
    };
  } catch {
    const state = withChecksum({
      schemaVersion: THEME_STYLE_SCHEMA_VERSION,
      revision: 0,
      updatedAt: null,
      updatedBy: null,
      items: [],
      tombstones: [],
    });
    return {
      state,
      diagnostics: emptyDiagnostics({
        parseStatus: 'corrupt',
        checksumStatus: 'mismatch',
        issues: [
          {
            code: 'THEME_STYLE_LIBRARY_CORRUPT',
            message: 'Theme style library JSON could not be parsed.',
            severity: 'error',
          },
        ],
      }),
    };
  }
}

function responseFromRead(read: ReadResult): ThemeStyleLibraryResponse {
  return {
    schemaVersion: THEME_STYLE_SCHEMA_VERSION,
    revision: read.state.revision,
    checksum: read.state.checksum,
    updatedAt: read.state.updatedAt,
    updatedBy: read.state.updatedBy,
    items: read.state.items,
    total: read.state.items.length,
    diagnostics: read.diagnostics,
  };
}

function assertExpectedRevision(
  state: ThemeStyleLibraryState,
  expectedRevision?: number,
) {
  if (expectedRevision == null) return;
  if (expectedRevision !== state.revision) {
    throw error(
      ConflictException,
      'THEME_STYLE_VERSION_CONFLICT',
      `Theme style library revision changed from ${expectedRevision} to ${state.revision}.`,
    );
  }
}

function assertLibrarySize(state: ThemeStyleLibraryState) {
  const size = Buffer.byteLength(JSON.stringify(state), 'utf8');
  if (size > MAX_THEME_STYLE_JSON_BYTES) {
    throw error(
      BadRequestException,
      'THEME_STYLE_LIBRARY_TOO_LARGE',
      'Theme style library payload is too large.',
    );
  }
}

function nextState(
  current: ThemeStyleLibraryState,
  user: CurrentUserPayload,
  items: ThemeStyleLibraryItem[],
  tombstones = current.tombstones,
) {
  const now = new Date().toISOString();
  return withChecksum({
    schemaVersion: THEME_STYLE_SCHEMA_VERSION,
    revision: current.revision + 1,
    updatedAt: now,
    updatedBy: actorFromUser(user),
    items: items
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, MAX_THEME_STYLE_ITEMS),
    tombstones,
  });
}

@ApiTags('admin')
@ApiBearerAuth()
@ThrottleRelaxed()
@Controller('admin/theme-styles')
@Roles(Role.ADMIN)
export class AdminThemeStyleController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  private async readSetting() {
    let setting = await this.prisma.systemSetting.findUnique({
      where: { key: THEME_STYLE_SETTING_KEY },
    });

    // Auto-seed on first read so /admin/theme-styles is never blank on a fresh
    // deploy. The setting row is missing on a clean DB (e.g. just-deployed
    // production); generate the curated 144-item default library and persist.
    if (!setting) {
      const items = generateDefaultThemeStyleItems();
      const now = new Date().toISOString();
      const stateNoChecksum = {
        schemaVersion: THEME_STYLE_SCHEMA_VERSION,
        revision: 1,
        updatedAt: now,
        updatedBy: SYSTEM_SEED_ACTOR as ThemeStyleActor,
        items,
        tombstones: [] as ThemeStyleTombstone[],
      };
      const seededValue = JSON.stringify({
        ...stateNoChecksum,
        checksum: checksumState(stateNoChecksum),
      });
      try {
        setting = await this.prisma.systemSetting.create({
          data: { key: THEME_STYLE_SETTING_KEY, value: seededValue },
        });
      } catch {
        // Race condition (concurrent first-read inserted before us). Re-fetch.
        setting = await this.prisma.systemSetting.findUnique({
          where: { key: THEME_STYLE_SETTING_KEY },
        });
      }
    }

    return { setting, read: readLibrary(setting?.value) };
  }

  private async persist(
    setting: Awaited<ReturnType<typeof this.readSetting>>['setting'],
    state: ThemeStyleLibraryState,
  ) {
    assertLibrarySize(state);
    const serialized = JSON.stringify(state);
    if (!setting) {
      try {
        await this.prisma.systemSetting.create({
          data: {
            key: THEME_STYLE_SETTING_KEY,
            value: serialized,
            description: 'Admin Theme Debug Workbench style library',
            category: 'design',
          },
        });
        return;
      } catch {
        throw error(
          ConflictException,
          'THEME_STYLE_VERSION_CONFLICT',
          'Theme style library was created by another request. Refresh and retry.',
        );
      }
    }

    const result = await this.prisma.systemSetting.updateMany({
      where: { key: THEME_STYLE_SETTING_KEY, updatedAt: setting.updatedAt },
      data: {
        value: serialized,
        description: 'Admin Theme Debug Workbench style library',
        category: 'design',
      },
    });
    if (result.count !== 1) {
      throw error(
        ConflictException,
        'THEME_STYLE_VERSION_CONFLICT',
        'Theme style library changed while saving. Refresh and retry.',
      );
    }
  }

  private async logThemeAction(params: {
    user: CurrentUserPayload;
    action: AuditAction;
    resourceId?: string;
    metadata: Record<string, unknown>;
  }) {
    await this.auditLog.log({
      userId: params.user.id,
      action: params.action,
      resource: 'theme-style-library',
      resourceId: params.resourceId,
      metadata: params.metadata,
    });
  }

  @Get()
  @ApiOperation({ summary: 'List saved admin theme style preferences' })
  async listThemeStyles() {
    const { read } = await this.readSetting();
    return responseFromRead(read);
  }

  @Get('diagnostics')
  @ApiOperation({ summary: 'Inspect theme style library diagnostics' })
  async getDiagnostics() {
    const { read } = await this.readSetting();
    return {
      revision: read.state.revision,
      checksum: read.state.checksum,
      diagnostics: read.diagnostics,
    };
  }

  @Get('certification')
  @ApiOperation({ summary: 'Get enterprise theme certification matrix' })
  async getCertificationMatrix() {
    return buildThemeCertificationMatrix();
  }

  @Post('certify')
  @ApiOperation({
    summary: 'Certify a theme style without publishing or saving it',
  })
  async certifyThemeStyle(@Body() body: ThemeStyleCertifyInput) {
    const normalized = normalizeStyleInput(body);
    const blockingIssue = normalized.issues.find(
      (issue) => issue.severity === 'error',
    );
    if (blockingIssue || !normalized.palette || !normalized.heroVisual) {
      throw error(
        BadRequestException,
        'INVALID_THEME_CERTIFICATION_INPUT',
        blockingIssue?.message ?? 'Theme certification input is invalid.',
      );
    }

    return certifyEnterpriseTheme({
      palette: normalized.palette,
      heroVisual: normalized.heroVisual,
      appearanceOverrides: normalized.appearanceOverrides,
      routeAuditSummary: normalizeRouteAuditSummary(body.routeAuditSummary),
    });
  }

  @Post('validate')
  @ApiOperation({
    summary: 'Validate and normalize a theme style without saving',
  })
  async validateThemeStyle(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: ThemeStyleValidateInput,
  ): Promise<ThemeStyleValidateResponse> {
    const normalized = normalizeStyleInput(body);
    const valid = normalized.issues.every(
      (issue) => issue.severity !== 'error',
    );
    if (!valid) {
      await this.logThemeAction({
        user,
        action: AuditAction.THEME_STYLE_VALIDATE_FAILED,
        metadata: { issues: normalized.issues },
      });
    }

    return {
      valid,
      palette: normalized.palette,
      heroVisual: normalized.heroVisual,
      appearanceOverrides: normalized.appearanceOverrides,
      styleMeta: normalized.palette
        ? getThemeStyleMeta(normalized.palette, normalized.appearanceOverrides)
        : undefined,
      issues: normalized.issues,
    };
  }

  @Post()
  @ApiOperation({
    summary: 'Save current theme style into the admin style library',
  })
  async saveThemeStyle(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: ThemeStyleSaveInput,
  ) {
    const normalized = normalizeStyleInput(body);
    const blockingIssue = normalized.issues.find(
      (issue) => issue.severity === 'error',
    );
    if (blockingIssue || !normalized.palette || !normalized.heroVisual) {
      throw error(
        BadRequestException,
        'INVALID_THEME_STYLE_INPUT',
        blockingIssue?.message ?? 'Theme style input is invalid.',
      );
    }

    const { setting, read } = await this.readSetting();
    assertExpectedRevision(read.state, body.expectedRevision);

    const palette = normalized.palette;
    const heroVisual = normalized.heroVisual;
    const appearanceOverrides = normalized.appearanceOverrides;
    const now = new Date().toISOString();
    const styleMeta = getThemeStyleMeta(palette, appearanceOverrides);
    const certificationResult = certifyEnterpriseTheme({
      palette,
      heroVisual,
      appearanceOverrides,
      certifiedAt: now,
    });
    const heroVisualDefinition = getHeroVisualDefinition(heroVisual);
    const actor = actorFromUser(user);
    const nextRevision = read.state.revision + 1;
    const signature = makeSignature({
      palette,
      heroVisual,
      appearanceOverrides,
    });
    const existingIndex = read.state.items.findIndex(
      (item) => item.signature === signature,
    );
    const savedByEntry = { ...actor, savedAt: now };
    const items = [...read.state.items];

    if (existingIndex >= 0) {
      const existing = items[existingIndex];
      const savedBy = [
        savedByEntry,
        ...existing.savedBy.filter((entry) => entry.userId !== user.id),
      ];
      items[existingIndex] = {
        ...existing,
        styleMeta,
        certificationStatus: certificationResult.status,
        certificationResult,
        routeAuditSummary: certificationResult.routeAuditSummary,
        sourcePath: normalizeSourcePath(body.sourcePath) ?? existing.sourcePath,
        savedBy,
        voteCount: savedBy.length,
        updatedBy: actor,
        lastAction: 'saved',
        revisionUpdated: nextRevision,
        updatedAt: now,
      };
    } else {
      items.unshift({
        id: `theme-style-${signature}`,
        signature,
        palette,
        paletteLabelZh: getColorThemeLabel(palette, 'zh'),
        paletteLabelEn: getColorThemeLabel(palette, 'en'),
        paletteDescriptionZh: getColorThemeDescription(palette, 'zh'),
        paletteDescriptionEn: getColorThemeDescription(palette, 'en'),
        heroVisual,
        heroVisualLabelZh: heroVisualDefinition.labelZh,
        heroVisualLabelEn: heroVisualDefinition.labelEn,
        heroVisualDescriptionZh: heroVisualDefinition.descriptionZh,
        heroVisualDescriptionEn: heroVisualDefinition.descriptionEn,
        appearanceOverrides,
        styleMeta,
        status: 'draft',
        validationStatus: normalized.issues.length ? 'warning' : 'unknown',
        validationErrors: normalized.issues,
        certificationStatus: certificationResult.status,
        certificationResult,
        routeAuditSummary: certificationResult.routeAuditSummary,
        debugTags: [],
        sourcePath: normalizeSourcePath(body.sourcePath),
        voteCount: 1,
        savedBy: [savedByEntry],
        createdBy: actor,
        updatedBy: actor,
        lastAction: 'saved',
        revisionCreated: nextRevision,
        revisionUpdated: nextRevision,
        createdAt: now,
        updatedAt: now,
      });
    }

    const next = nextState(read.state, user, items);
    await this.persist(setting, next);
    await this.logThemeAction({
      user,
      action: AuditAction.THEME_STYLE_SAVE,
      resourceId: `theme-style-${signature}`,
      metadata: {
        beforeRevision: read.state.revision,
        afterRevision: next.revision,
        beforeChecksum: read.state.checksum,
        afterChecksum: next.checksum,
        styleId: `theme-style-${signature}`,
        signature,
        sourcePath: normalizeSourcePath(body.sourcePath),
        clientRequestId: body.clientRequestId,
        diffSummary:
          existingIndex >= 0 ? 'updated existing style vote' : 'created style',
        beforeState: read.state,
        afterState: next,
      },
    });

    return next.items.find((item) => item.signature === signature);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update theme style metadata or verification status',
  })
  async patchThemeStyle(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() body: ThemeStylePatchInput,
  ) {
    const { setting, read } = await this.readSetting();
    assertExpectedRevision(read.state, body.expectedRevision);
    const index = read.state.items.findIndex((item) => item.id === id);
    if (index < 0) {
      throw new NotFoundException({
        code: 'THEME_STYLE_NOT_FOUND',
        message: 'Theme style was not found.',
      });
    }

    const actor = actorFromUser(user);
    const now = new Date().toISOString();
    const nextRevision = read.state.revision + 1;
    const current = read.state.items[index];
    const status = allowedStatuses.includes(body.status as ThemeStyleStatus)
      ? (body.status as ThemeStyleStatus)
      : current.status;
    const routeAuditSummary =
      body.routeAuditSummary !== undefined
        ? normalizeRouteAuditSummary(body.routeAuditSummary)
        : current.routeAuditSummary;
    const certificationResult = certifyEnterpriseTheme({
      palette: current.palette,
      heroVisual: current.heroVisual,
      appearanceOverrides: current.appearanceOverrides,
      routeAuditSummary,
      certifiedAt: now,
    });
    if (status === 'verified' && certificationResult.status === 'failed') {
      throw error(
        UnprocessableEntityException,
        'THEME_STYLE_CERTIFICATION_FAILED',
        'Theme style cannot be marked verified until certification passes.',
      );
    }
    const validationStatus = allowedValidationStatuses.includes(
      body.validationStatus as ThemeStyleValidationStatus,
    )
      ? (body.validationStatus as ThemeStyleValidationStatus)
      : status === 'verified'
        ? 'passed'
        : current.validationStatus;
    const items = [...read.state.items];
    items[index] = {
      ...current,
      status,
      validationStatus,
      validationErrors:
        body.validationErrors !== undefined
          ? normalizeValidationIssues(body.validationErrors)
          : status === 'verified'
            ? []
            : current.validationErrors,
      certificationStatus: allowedCertificationStatuses.includes(
        body.certificationStatus as ThemeCertificationStatus,
      )
        ? (body.certificationStatus as ThemeCertificationStatus)
        : certificationResult.status,
      certificationResult,
      routeAuditSummary: certificationResult.routeAuditSummary,
      verifiedAt:
        status === 'verified'
          ? (current.verifiedAt ?? now)
          : current.verifiedAt,
      notes:
        body.notes !== undefined
          ? normalizeShortText(body.notes)
          : current.notes,
      debugTags:
        body.debugTags !== undefined
          ? normalizeStringList(body.debugTags)
          : current.debugTags,
      updatedBy: actor,
      lastAction: status === 'verified' ? 'verified' : 'updated',
      revisionUpdated: nextRevision,
      updatedAt: now,
    };

    const next = nextState(read.state, user, items);
    await this.persist(setting, next);
    await this.logThemeAction({
      user,
      action: AuditAction.THEME_STYLE_UPDATE,
      resourceId: id,
      metadata: {
        beforeRevision: read.state.revision,
        afterRevision: next.revision,
        beforeChecksum: read.state.checksum,
        afterChecksum: next.checksum,
        styleId: id,
        clientRequestId: body.clientRequestId,
        diffSummary: `updated style metadata/status to ${items[index].status}`,
        beforeState: read.state,
        afterState: next,
      },
    });

    return next.items.find((item) => item.id === id);
  }

  @Post('rollback')
  @ApiOperation({
    summary: 'Rollback theme style library to an audited revision',
  })
  async rollbackThemeStyles(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: ThemeStyleRollbackInput,
  ) {
    const { setting, read } = await this.readSetting();
    assertExpectedRevision(read.state, body.expectedRevision);
    const target = await this.findRollbackTarget(body);
    if (!target) {
      throw new NotFoundException({
        code: 'THEME_STYLE_ROLLBACK_TARGET_NOT_FOUND',
        message: 'Rollback target revision was not found in recent audit logs.',
      });
    }

    const actor = actorFromUser(user);
    const now = new Date().toISOString();
    const candidate = withChecksum({
      ...target,
      revision: read.state.revision + 1,
      updatedAt: now,
      updatedBy: actor,
      items: target.items.map((item) => ({
        ...item,
        lastAction: 'rollback',
        updatedBy: actor,
        revisionUpdated: read.state.revision + 1,
        updatedAt: now,
      })),
      tombstones: target.tombstones ?? [],
    });

    if (body.dryRun) {
      return {
        dryRun: true,
        currentRevision: read.state.revision,
        rollbackToRevision: target.revision,
        candidate,
      };
    }

    await this.persist(setting, candidate);
    await this.logThemeAction({
      user,
      action: AuditAction.THEME_STYLE_ROLLBACK,
      metadata: {
        beforeRevision: read.state.revision,
        afterRevision: candidate.revision,
        rollbackToRevision: target.revision,
        beforeChecksum: read.state.checksum,
        afterChecksum: candidate.checksum,
        reason: normalizeShortText(body.reason),
        clientRequestId: body.clientRequestId,
        diffSummary: 'rolled back theme style library',
        beforeState: read.state,
        afterState: candidate,
      },
    });

    return responseFromRead({
      state: candidate,
      diagnostics: emptyDiagnostics({ itemCount: candidate.items.length }),
    });
  }

  private async findRollbackTarget(body: ThemeStyleRollbackInput) {
    const logs = await this.prisma.auditLog.findMany({
      where: {
        resource: 'theme-style-library',
        ...(body.targetAuditLogId ? { id: body.targetAuditLogId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: body.targetAuditLogId ? 1 : 100,
    });

    for (const log of logs) {
      const metadata = log.metadata as {
        beforeState?: ThemeStyleLibraryState;
        afterState?: ThemeStyleLibraryState;
      } | null;
      const candidates = [metadata?.afterState, metadata?.beforeState].filter(
        Boolean,
      ) as ThemeStyleLibraryState[];
      for (const candidate of candidates) {
        if (
          body.targetAuditLogId ||
          candidate.revision === body.targetRevision
        ) {
          return withChecksum({
            schemaVersion: THEME_STYLE_SCHEMA_VERSION,
            revision: candidate.revision,
            updatedAt: candidate.updatedAt,
            updatedBy: candidate.updatedBy,
            items: candidate.items,
            tombstones: candidate.tombstones ?? [],
          });
        }
      }
    }
    return null;
  }
}
