import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { load } from 'cheerio';
import {
  Prisma,
  SchoolMediaSourceType,
  SchoolMediaStatus,
  SchoolMediaType,
} from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../common/storage/storage.service';
import {
  AuditAction,
  AuditLogService,
} from '../../common/services/audit-log.service';
import { SchoolWriteService } from './school-write.service';
import { extractSchoolLogoDomain } from '../../common/utils/school-logo.util';
import {
  parseSchoolMediaSources,
  type SchoolMediaDiscoverDto,
  type SchoolMediaListQueryDto,
} from './dto/school-media.dto';

const MIN_COVER_WIDTH = 500;
const MIN_COVER_HEIGHT = 250;
const WIKIMEDIA_SEARCH_LIMIT = 20;
const WIKIMEDIA_CATEGORY_LIMIT = 20;
const FETCH_TIMEOUT_MS = 12_000;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const USER_AGENT =
  'Mozilla/5.0 (compatible; LumniEduSchoolMediaBot/1.0; +https://lumniedu.com)';
const BROWSER_SAFE_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);
const SCHOOL_NAME_STOPWORDS = new Set([
  'and',
  'at',
  'college',
  'institute',
  'of',
  'school',
  'the',
  'technology',
  'university',
]);
const SCHOOL_ALIAS_OVERRIDES: Record<string, string[]> = {
  'augustana university': [
    'augustana university south dakota',
    'augustana university sioux falls',
  ],
  baruch: ['baruch college', 'bernard m baruch college'],
  'california institute of technology': ['caltech'],
  macalester: ['macalester college'],
  'massachusetts institute of technology': ['mit'],
  pitzer: ['pitzer college'],
  reed: ['reed college'],
  umn: [
    'university of minnesota twin cities',
    'university of minnesota',
    'u of m',
  ],
  'university of pennsylvania': ['upenn', 'penn'],
  'university of california, berkeley': ['uc berkeley', 'cal'],
  'university of california, los angeles': ['ucla'],
  'university of california, riverside': ['uc riverside'],
  'university of california, santa cruz': ['uc santa cruz'],
  'university of california, merced': ['uc merced'],
  whitman: ['whitman college'],
  'wheaton college massachusetts': [
    'wheaton college norton massachusetts',
    'wheaton college ma',
  ],
};
const WIKIMEDIA_SEARCH_QUERY_OVERRIDES: Record<string, string[]> = {
  'augustana university': [
    'Augustana University South Dakota campus',
    'Augustana University Old Main East Hall',
  ],
  baruch: ['Baruch College Newman Vertical Campus'],
  macalester: ['Macalester College campus', 'Macalester College Old Main'],
  'pacific lutheran university': [
    'Pacific Lutheran University campus',
    'Pacific Lutheran University Harstad Hall',
  ],
  pitzer: ['Pitzer College campus', 'Pitzer College Phase II'],
  reed: ['Reed College campus'],
  umn: [
    'University of Minnesota Twin Cities campus',
    'University of Minnesota Northrop Mall',
  ],
  'wheaton college massachusetts': [
    'Wheaton College Massachusetts campus',
    'Wheaton College Norton Massachusetts campus',
  ],
  whitman: ['Whitman College campus'],
};
const WIKIMEDIA_POSITIVE_TITLE_TERMS = [
  'academic',
  'administration',
  'aerial',
  'armory',
  'building',
  'buildings',
  'campus',
  'chapel',
  'college hall',
  'commons',
  'hall',
  'library',
  'main',
  'mall',
  'newman vertical campus',
  'old main',
  'quad',
  'upper campus',
  'walk',
  'west campus',
];
const WIKIMEDIA_REJECT_TITLE_TERMS = [
  'annual catalogue',
  'blueprint',
  'bus',
  'catalogue',
  'certificate',
  'cross section',
  'diagram',
  'drawing',
  'elevation',
  'emblem',
  'flag',
  'floor plan',
  'flower',
  'hood',
  'landscape plan',
  'logo',
  'map',
  'marker',
  'mascot',
  'master plan',
  'plaque',
  'regalia',
  'rendering',
  'schematic',
  'seal',
  'sign',
  'site plan',
  'sketch',
  'truck',
  'turtle',
];

const OFFICIAL_CDN_HOST_PARTS = [
  'cloudfront.net',
  'cloudinary.com',
  'imgix.net',
  'wp.com',
  'wordpress.com',
  'squarespace-cdn.com',
  'website-files.com',
  'akamai',
  'fastly',
  'azureedge.net',
  'amazonaws.com',
];

interface ImageCandidate {
  originalUrl: string;
  sourcePageUrl: string;
  sourceType: SchoolMediaSourceType;
  license?: string | null;
  author?: string | null;
  attribution?: string | null;
  width?: number | null;
  height?: number | null;
  hash?: string | null;
  buffer?: Buffer;
  mimetype?: string;
  failureReason?: string | null;
}

interface ImageProbe {
  width: number;
  height: number;
  mimetype: string;
}

interface WikimediaImageInfo {
  url?: string;
  descriptionurl?: string;
  mime?: string;
  width?: number;
  height?: number;
  extmetadata?: Record<string, { value?: string }>;
}

interface WikimediaPage {
  title?: string;
  imageinfo?: WikimediaImageInfo[];
}

type WikimediaCandidate = ImageCandidate & { score: number };

function normalizeMetaUrl(
  raw: string | undefined,
  pageUrl: string,
): string | null {
  if (!raw?.trim()) return null;
  try {
    return new URL(raw.trim(), pageUrl).toString();
  } catch {
    return null;
  }
}

function isLogoLike(width: number, height: number): boolean {
  const ratio = width / height;
  return ratio >= 0.85 && ratio <= 1.15;
}

function getPngDimensions(
  buffer: Buffer,
): { width: number; height: number } | null {
  if (buffer.length < 24 || buffer.toString('ascii', 1, 4) !== 'PNG')
    return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function getJpegDimensions(
  buffer: Buffer,
): { width: number; height: number } | null {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8)
    return null;
  let offset = 2;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2) return null;
    if (
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf)
    ) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }
    offset += 2 + length;
  }
  return null;
}

function getWebpDimensions(
  buffer: Buffer,
): { width: number; height: number } | null {
  if (
    buffer.length < 30 ||
    buffer.toString('ascii', 0, 4) !== 'RIFF' ||
    buffer.toString('ascii', 8, 12) !== 'WEBP'
  ) {
    return null;
  }
  const chunk = buffer.toString('ascii', 12, 16);
  if (chunk === 'VP8X' && buffer.length >= 30) {
    return {
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3),
    };
  }
  if (chunk === 'VP8 ' && buffer.length >= 30) {
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff,
    };
  }
  if (chunk === 'VP8L' && buffer.length >= 25) {
    const bits = buffer.readUInt32LE(21);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    };
  }
  return null;
}

function probeImage(
  buffer: Buffer,
  contentType?: string | null,
): ImageProbe | null {
  const normalizedType = contentType?.split(';')[0]?.trim().toLowerCase();
  const png = getPngDimensions(buffer);
  if (png) return { ...png, mimetype: normalizedType || 'image/png' };
  const jpeg = getJpegDimensions(buffer);
  if (jpeg) return { ...jpeg, mimetype: normalizedType || 'image/jpeg' };
  const webp = getWebpDimensions(buffer);
  if (webp) return { ...webp, mimetype: normalizedType || 'image/webp' };
  return null;
}

function extFromMime(mimetype: string): string {
  switch (mimetype) {
    case 'image/png':
      return '.png';
    case 'image/webp':
      return '.webp';
    case 'image/jpeg':
    case 'image/jpg':
    default:
      return '.jpg';
  }
}

function normalizeMime(mimetype: string | null | undefined): string | null {
  return mimetype?.split(';')[0]?.trim().toLowerCase() || null;
}

function isBrowserSafeImageMime(mimetype: string | null | undefined): boolean {
  const normalized = normalizeMime(mimetype);
  return !!normalized && BROWSER_SAFE_IMAGE_MIMES.has(normalized);
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeSearchText(value: string | undefined): string {
  if (!value) return '';
  return safeDecode(value)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getSchoolAliases(name: string, aliases?: string[] | null): string[] {
  const normalizedName = normalizeSearchText(name);
  return [
    ...new Set(
      [...(aliases ?? []), ...(SCHOOL_ALIAS_OVERRIDES[normalizedName] ?? [])]
        .map((alias) => normalizeSearchText(alias))
        .filter((alias) => alias.length >= 2 && alias !== normalizedName),
    ),
  ];
}

function getSchoolMatchTerms(name: string): string[] {
  const words = name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const distinctive = words.filter(
    (word) => word.length >= 3 && !SCHOOL_NAME_STOPWORDS.has(word),
  );
  const acronym = words
    .filter((word) => !['and', 'at', 'of', 'the'].includes(word))
    .map((word) => word[0])
    .join('');

  return [
    ...new Set([...distinctive, ...(acronym.length >= 3 ? [acronym] : [])]),
  ];
}

function hasInstitutionTypeConflict(
  schoolName: string,
  haystack: string,
  aliases: string[],
): boolean {
  const normalizedName = normalizeSearchText(schoolName);
  if (
    haystack.includes(normalizedName) ||
    aliases.some((alias) => haystack.includes(alias))
  ) {
    return false;
  }
  const firstTerm = getSchoolMatchTerms(schoolName)[0];
  if (!firstTerm) return false;
  if (
    normalizedName.includes(' college') &&
    haystack.includes(`${firstTerm} university`) &&
    !haystack.includes(`${firstTerm} college`)
  ) {
    return true;
  }
  if (
    normalizedName.includes(' university') &&
    haystack.includes(`${firstTerm} college`) &&
    !haystack.includes(`${firstTerm} university`)
  ) {
    return true;
  }
  return false;
}

function matchesSchoolName(
  schoolName: string,
  aliases: string[] | null | undefined,
  title: string | undefined,
  sourcePageUrl: string,
): boolean {
  const terms = getSchoolMatchTerms(schoolName);
  if (!terms.length) return true;
  const normalizedAliases = getSchoolAliases(schoolName, aliases);
  const haystack = normalizeSearchText(`${title ?? ''} ${sourcePageUrl}`);
  if (hasInstitutionTypeConflict(schoolName, haystack, normalizedAliases)) {
    return false;
  }
  const normalizedName = normalizeSearchText(schoolName);
  return (
    haystack.includes(normalizedName) ||
    normalizedAliases.some((alias) => haystack.includes(alias)) ||
    terms.some((term) => haystack.includes(term))
  );
}

function scoreWikimediaCandidate(
  schoolName: string,
  aliases: string[] | null | undefined,
  page: WikimediaPage,
  info: WikimediaImageInfo,
): number | null {
  const haystack = normalizeSearchText(
    `${page.title ?? ''} ${info.descriptionurl ?? ''}`,
  );
  if (
    WIKIMEDIA_REJECT_TITLE_TERMS.some((term) => haystack.includes(term)) ||
    haystack.includes('people reacting')
  ) {
    return null;
  }

  const normalizedName = normalizeSearchText(schoolName);
  const normalizedAliases = getSchoolAliases(schoolName, aliases);
  const width = info.width ?? 0;
  const height = info.height ?? 0;
  const ratio = height > 0 ? width / height : 0;
  let score = 0;

  if (haystack.includes(normalizedName)) score += 80;
  if (normalizedAliases.some((alias) => haystack.includes(alias))) score += 70;
  for (const term of getSchoolMatchTerms(schoolName)) {
    if (haystack.includes(term)) score += 12;
  }
  for (const term of WIKIMEDIA_POSITIVE_TITLE_TERMS) {
    if (haystack.includes(term)) score += 10;
  }
  if (ratio >= 1.15 && ratio <= 2.4) score += 18;
  else if (ratio >= 0.95 && ratio < 1.15) score -= 20;
  else if (ratio < 0.95) score -= 12;
  if (width >= 1200 && height >= 700) score += 8;

  return score >= 20 ? score : null;
}

@Injectable()
export class SchoolMediaService {
  private readonly logger = new Logger(SchoolMediaService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly schoolWriteService: SchoolWriteService,
    private readonly auditLog: AuditLogService,
  ) {}

  async listAssets(query: SchoolMediaListQueryDto) {
    const where: Prisma.SchoolMediaAssetWhereInput = {
      ...(query.type ? { type: query.type } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.sourceType ? { sourceType: query.sourceType } : {}),
      ...(query.schoolId ? { schoolId: query.schoolId } : {}),
    };

    return this.prisma.schoolMediaAsset.findMany({
      where,
      include: {
        school: {
          select: { id: true, name: true, nameZh: true, website: true },
        },
      },
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
      take: query.limit ?? 50,
    });
  }

  async getCoverage() {
    const [totalSchools, grouped, approvedPrimary] = await Promise.all([
      this.prisma.school.count(),
      this.prisma.schoolMediaAsset.groupBy({
        by: ['type', 'status'],
        _count: { _all: true },
      }),
      this.prisma.schoolMediaAsset.findMany({
        where: {
          type: SchoolMediaType.CAMPUS_COVER,
          status: SchoolMediaStatus.APPROVED,
          isPrimary: true,
        },
        select: { schoolId: true },
        distinct: ['schoolId'],
      }),
    ]);

    const byTypeStatus = grouped.reduce<Record<string, number>>((acc, row) => {
      acc[`${row.type}:${row.status}`] = row._count._all;
      return acc;
    }, {});

    return {
      totalSchools,
      campusCover: {
        approvedPrimary: approvedPrimary.length,
        missingPrimary: Math.max(0, totalSchools - approvedPrimary.length),
        candidate:
          byTypeStatus[
            `${SchoolMediaType.CAMPUS_COVER}:${SchoolMediaStatus.CANDIDATE}`
          ] ?? 0,
        pendingReview:
          byTypeStatus[
            `${SchoolMediaType.CAMPUS_COVER}:${SchoolMediaStatus.PENDING_REVIEW}`
          ] ?? 0,
        failed:
          byTypeStatus[
            `${SchoolMediaType.CAMPUS_COVER}:${SchoolMediaStatus.FAILED}`
          ] ?? 0,
        rejected:
          byTypeStatus[
            `${SchoolMediaType.CAMPUS_COVER}:${SchoolMediaStatus.REJECTED}`
          ] ?? 0,
      },
      logo: {
        approvedPrimary:
          byTypeStatus[
            `${SchoolMediaType.LOGO}:${SchoolMediaStatus.APPROVED}`
          ] ?? 0,
        candidate:
          byTypeStatus[
            `${SchoolMediaType.LOGO}:${SchoolMediaStatus.CANDIDATE}`
          ] ?? 0,
        pendingReview:
          byTypeStatus[
            `${SchoolMediaType.LOGO}:${SchoolMediaStatus.PENDING_REVIEW}`
          ] ?? 0,
        failed:
          byTypeStatus[`${SchoolMediaType.LOGO}:${SchoolMediaStatus.FAILED}`] ??
          0,
      },
    };
  }

  async discoverMedia(dto: SchoolMediaDiscoverDto, userId?: string) {
    const limit = Math.min(Math.max(1, dto.limit ?? 100), 500);
    const sources = parseSchoolMediaSources(dto.source);
    const dryRun = dto.dryRun === true;
    const canDiscoverWithoutWebsite = sources.includes('wikimedia');

    const schools = await this.prisma.school.findMany({
      where: {
        ...(dto.schoolId ? { id: dto.schoolId } : {}),
        ...(canDiscoverWithoutWebsite ? {} : { website: { not: null } }),
      },
      select: {
        id: true,
        name: true,
        aliases: true,
        website: true,
        mediaAssets: {
          where: {
            type: SchoolMediaType.CAMPUS_COVER,
            status: SchoolMediaStatus.APPROVED,
            isPrimary: true,
          },
          select: { id: true },
          take: 1,
        },
      },
      orderBy: [{ usNewsRank: 'asc' }, { name: 'asc' }],
      take: limit,
    });

    const result = {
      processed: 0,
      approved: 0,
      candidates: 0,
      pendingReview: 0,
      failed: 0,
      skipped: 0,
      dryRun,
      items: [] as Array<Record<string, unknown>>,
    };

    for (const school of schools) {
      if (school.mediaAssets.length && !dto.schoolId) {
        result.skipped += 1;
        continue;
      }
      result.processed += 1;
      const item = await this.discoverForSchool(
        {
          id: school.id,
          name: school.name,
          aliases: school.aliases,
          website: school.website,
        },
        sources,
        dryRun,
      );
      result.items.push(item);
      if (item.status === SchoolMediaStatus.APPROVED) result.approved += 1;
      else if (item.status === SchoolMediaStatus.PENDING_REVIEW)
        result.pendingReview += 1;
      else if (item.status === SchoolMediaStatus.CANDIDATE)
        result.candidates += 1;
      else if (item.status === SchoolMediaStatus.FAILED) result.failed += 1;
    }

    if (!dryRun) {
      await this.auditLog.log({
        userId: userId ?? 'system',
        action: AuditAction.ADMIN_ACTION,
        resource: 'school-media',
        resourceId: dto.schoolId ?? '',
        metadata: {
          action: 'SCHOOL_MEDIA_DISCOVER',
          ...result,
          items: result.items.slice(0, 20),
        },
      });
    }

    return result;
  }

  async approveAsset(assetId: string, userId: string, reason?: string) {
    const asset = await this.requireAsset(assetId);
    let storageUrl = asset.storageUrl;
    let width = asset.width;
    let height = asset.height;
    let hash = asset.hash;

    if (!storageUrl && asset.originalUrl) {
      const canPersistPublicMedia = this.canPersistPublicMedia();
      const canApproveExternalOriginal = this.canApproveExternalOriginalUrl(
        asset.sourceType,
      );
      if (!canPersistPublicMedia && !canApproveExternalOriginal) {
        throw new BadRequestException(
          'Public media storage is not configured for production',
        );
      }
      const downloaded = await this.downloadAndValidateCover(
        asset.originalUrl,
        asset.sourcePageUrl ?? asset.originalUrl,
        asset.schoolId,
      );
      if (canPersistPublicMedia) {
        const uploaded = await this.storage.uploadSchoolMedia(
          asset.schoolId,
          asset.type,
          {
            buffer: downloaded.buffer!,
            mimetype: downloaded.mimetype!,
            originalname: `${asset.id}${extFromMime(downloaded.mimetype!)}`,
            hash: downloaded.hash!,
          },
        );
        storageUrl = uploaded.url;
      }
      width = downloaded.width ?? null;
      height = downloaded.height ?? null;
      hash = downloaded.hash ?? null;
    }

    await this.setPrimaryTransaction(asset.schoolId, asset.type, assetId, {
      storageUrl,
      width,
      height,
      hash,
      status: SchoolMediaStatus.APPROVED,
      reviewedBy: userId,
      reviewedAt: new Date(),
      failureReason: reason ?? null,
    });
    await this.schoolWriteService.invalidateSchoolCaches(asset.schoolId);
    await this.auditAsset(userId, 'APPROVE', assetId, reason);
    return this.requireAsset(assetId);
  }

  async rejectAsset(assetId: string, userId: string, reason?: string) {
    const asset = await this.requireAsset(assetId);
    const updated = await this.prisma.schoolMediaAsset.update({
      where: { id: assetId },
      data: {
        status: SchoolMediaStatus.REJECTED,
        isPrimary: false,
        reviewedBy: userId,
        reviewedAt: new Date(),
        failureReason: reason ?? null,
      },
    });
    await this.schoolWriteService.invalidateSchoolCaches(asset.schoolId);
    await this.auditAsset(userId, 'REJECT', assetId, reason);
    return updated;
  }

  async setPrimary(assetId: string, userId: string) {
    const asset = await this.requireAsset(assetId);
    if (asset.status !== SchoolMediaStatus.APPROVED) {
      throw new BadRequestException('Only approved media can be primary');
    }
    await this.setPrimaryTransaction(asset.schoolId, asset.type, assetId, {
      reviewedBy: userId,
      reviewedAt: new Date(),
    });
    await this.schoolWriteService.invalidateSchoolCaches(asset.schoolId);
    await this.auditAsset(userId, 'SET_PRIMARY', assetId);
    return this.requireAsset(assetId);
  }

  async retryAsset(assetId: string, userId: string) {
    const asset = await this.requireAsset(assetId);
    if (!asset.originalUrl) {
      throw new BadRequestException('Media asset has no original URL to retry');
    }
    const candidate = await this.downloadAndValidateCover(
      asset.originalUrl,
      asset.sourcePageUrl ?? asset.originalUrl,
      asset.schoolId,
    );
    const canPersistPublicMedia = this.canPersistPublicMedia();
    const canApproveExternalOriginal = this.canApproveExternalOriginalUrl(
      asset.sourceType,
    );
    const status =
      canPersistPublicMedia || canApproveExternalOriginal
        ? SchoolMediaStatus.APPROVED
        : SchoolMediaStatus.CANDIDATE;
    const uploaded = canPersistPublicMedia
      ? await this.storage.uploadSchoolMedia(asset.schoolId, asset.type, {
          buffer: candidate.buffer!,
          mimetype: candidate.mimetype!,
          originalname: `${asset.id}${extFromMime(candidate.mimetype!)}`,
          hash: candidate.hash!,
        })
      : null;

    if (status === SchoolMediaStatus.APPROVED) {
      await this.setPrimaryTransaction(asset.schoolId, asset.type, assetId, {
        status,
        storageUrl: uploaded?.url,
        width: candidate.width,
        height: candidate.height,
        hash: candidate.hash,
        reviewedBy: userId,
        reviewedAt: new Date(),
        failureReason: null,
      });
    } else {
      await this.prisma.schoolMediaAsset.update({
        where: { id: assetId },
        data: {
          status,
          width: candidate.width,
          height: candidate.height,
          hash: candidate.hash,
          failureReason:
            'Public media storage is not configured for production',
        },
      });
    }
    await this.schoolWriteService.invalidateSchoolCaches(asset.schoolId);
    await this.auditAsset(userId, 'RETRY', assetId);
    return this.requireAsset(assetId);
  }

  private async discoverForSchool(
    school: {
      id: string;
      name: string;
      aliases?: string[] | null;
      website: string | null;
    },
    sources: Array<'official' | 'wikimedia'>,
    dryRun: boolean,
  ) {
    const failures: string[] = [];

    for (const source of this.getDiscoverySourceOrder(sources)) {
      if (source === 'official' && school.website) {
        const official = await this.discoverOfficialCover(school).catch(
          (error) => {
            failures.push(
              String(error instanceof Error ? error.message : error),
            );
            return null;
          },
        );
        if (official) {
          return dryRun
            ? {
                schoolId: school.id,
                schoolName: school.name,
                status: 'DRY_RUN',
                candidate: official,
              }
            : this.persistCandidate(school.id, official);
        }
      }

      if (source === 'wikimedia') {
        const wikimedia = await this.discoverWikimediaCover(school).catch(
          (error) => {
            failures.push(
              String(error instanceof Error ? error.message : error),
            );
            return null;
          },
        );
        if (wikimedia) {
          return dryRun
            ? {
                schoolId: school.id,
                schoolName: school.name,
                status: 'DRY_RUN',
                candidate: wikimedia,
              }
            : this.persistCandidate(school.id, wikimedia);
        }
      }
    }

    if (dryRun) {
      return {
        schoolId: school.id,
        schoolName: school.name,
        status: 'DRY_RUN_FAILED',
        failures,
      };
    }

    return this.persistFailure(
      school.id,
      school.website,
      failures.join('; ') || 'No media found',
    );
  }

  private getDiscoverySourceOrder(
    sources: Array<'official' | 'wikimedia'>,
  ): Array<'official' | 'wikimedia'> {
    const ordered = [...new Set(sources)];
    if (!this.canPersistPublicMedia() && ordered.includes('wikimedia')) {
      return [
        'wikimedia',
        ...ordered.filter((source) => source !== 'wikimedia'),
      ];
    }
    return ordered;
  }

  private async discoverOfficialCover(school: {
    id: string;
    name: string;
    website: string | null;
  }): Promise<ImageCandidate | null> {
    if (!school.website) return null;
    const pageUrl = new URL(
      school.website.startsWith('http')
        ? school.website
        : `https://${school.website}`,
    );
    const res = await this.fetchWithTimeout(pageUrl.toString());
    if (!res.ok) {
      throw new Error(`Official site returned HTTP ${res.status}`);
    }
    const html = await res.text();
    const $ = load(html);
    const urls = new Set<string>();
    const rejections: string[] = [];

    $(
      'meta[property="og:image"], meta[property="og:image:secure_url"], meta[name="twitter:image"], meta[property="twitter:image"]',
    ).each((_idx, el) => {
      const url = normalizeMetaUrl(
        $(el).attr('content'),
        res.url || pageUrl.toString(),
      );
      if (url) urls.add(url);
    });
    $('link[rel="image_src"]').each((_idx, el) => {
      const url = normalizeMetaUrl(
        $(el).attr('href'),
        res.url || pageUrl.toString(),
      );
      if (url) urls.add(url);
    });

    for (const url of urls) {
      const candidate = await this.downloadAndValidateCover(
        url,
        res.url || pageUrl.toString(),
        school.id,
        school.website,
      ).catch((error) => {
        const message = String(error instanceof Error ? error.message : error);
        rejections.push(message);
        this.logger.debug(
          `Rejected official image for ${school.name}: ${message}`,
        );
        return null;
      });
      if (candidate) {
        return {
          ...candidate,
          sourceType: SchoolMediaSourceType.OFFICIAL_WEBSITE,
          sourcePageUrl: res.url || pageUrl.toString(),
        };
      }
    }
    if (urls.size > 0) {
      throw new Error(rejections.join('; ') || 'No valid official image found');
    }
    return null;
  }

  private async discoverWikimediaCover(school: {
    name: string;
    aliases?: string[] | null;
  }): Promise<ImageCandidate | null> {
    for (const query of this.getWikimediaSearchQueries(school)) {
      const pages = await this.fetchWikimediaPages(
        'generator=search',
        `gsrnamespace=6&gsrlimit=${WIKIMEDIA_SEARCH_LIMIT}&gsrsearch=${encodeURIComponent(query)}`,
      );
      const best = this.pickBestWikimediaCandidate(school, pages);
      if (best) return best;
    }

    for (const category of this.getWikimediaCategories(school)) {
      const pages = await this.fetchWikimediaPages(
        'generator=categorymembers',
        `gcmtitle=${encodeURIComponent(category)}&gcmtype=file&gcmlimit=${WIKIMEDIA_CATEGORY_LIMIT}`,
      );
      const best = this.pickBestWikimediaCandidate(school, pages);
      if (best) return best;
    }

    return null;
  }

  private getWikimediaSearchQueries(school: {
    name: string;
    aliases?: string[] | null;
  }): string[] {
    const aliases = getSchoolAliases(school.name, school.aliases);
    const normalizedName = normalizeSearchText(school.name);
    return [
      ...(WIKIMEDIA_SEARCH_QUERY_OVERRIDES[normalizedName] ?? []),
      `${school.name} campus`,
      ...aliases.map((alias) => `${alias} campus`),
      `${school.name} building`,
      ...aliases.map((alias) => `${alias} building`),
      school.name,
    ].filter((query, index, all) => all.indexOf(query) === index);
  }

  private getWikimediaCategories(school: {
    name: string;
    aliases?: string[] | null;
  }): string[] {
    return [
      `Category:${school.name}`,
      ...getSchoolAliases(school.name, school.aliases).map(
        (alias) => `Category:${alias}`,
      ),
    ].filter((category, index, all) => all.indexOf(category) === index);
  }

  private async fetchWikimediaPages(
    generator: string,
    query: string,
  ): Promise<WikimediaPage[]> {
    const url =
      `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&${generator}` +
      `&${query}&prop=imageinfo&iiprop=url|mime|size|metadata|extmetadata`;
    const res = await this.fetchWithTimeout(url);
    if (!res.ok) throw new Error(`Wikimedia returned HTTP ${res.status}`);
    const data = (await res.json()) as {
      query?: { pages?: Record<string, WikimediaPage> };
    };
    return Object.values(data.query?.pages ?? {});
  }

  private pickBestWikimediaCandidate(
    school: { name: string; aliases?: string[] | null },
    pages: WikimediaPage[],
  ): ImageCandidate | null {
    const candidates: WikimediaCandidate[] = [];

    for (const page of pages) {
      const info = page.imageinfo?.[0];
      if (!info?.url || !info.descriptionurl) continue;
      if (!isBrowserSafeImageMime(info.mime)) continue;
      if (
        !matchesSchoolName(
          school.name,
          school.aliases,
          page.title,
          info.descriptionurl,
        )
      ) {
        continue;
      }
      const score = scoreWikimediaCandidate(
        school.name,
        school.aliases,
        page,
        info,
      );
      if (score == null) continue;
      const meta = info.extmetadata ?? {};
      const license =
        meta.LicenseShortName?.value ??
        meta.License?.value ??
        meta.UsageTerms?.value;
      const author = meta.Artist?.value ?? meta.Credit?.value ?? null;
      const attribution =
        meta.Attribution?.value ?? meta.Credit?.value ?? author;
      if (!license || !attribution) continue;
      if (
        (info.width ?? 0) < MIN_COVER_WIDTH ||
        (info.height ?? 0) < MIN_COVER_HEIGHT
      ) {
        continue;
      }
      if (isLogoLike(info.width!, info.height!)) continue;
      candidates.push({
        originalUrl: info.url,
        sourcePageUrl: info.descriptionurl,
        sourceType: SchoolMediaSourceType.WIKIMEDIA_COMMONS,
        license,
        author,
        attribution,
        width: info.width,
        height: info.height,
        score,
      });
    }

    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];
    if (!best) return null;
    const { score: _score, ...candidate } = best;
    return candidate;
  }

  private async downloadAndValidateCover(
    imageUrl: string,
    sourcePageUrl: string,
    schoolId: string,
    officialWebsite?: string | null,
  ): Promise<ImageCandidate> {
    const parsed = new URL(imageUrl);
    if (parsed.protocol !== 'https:')
      throw new Error('Image URL must be HTTPS');
    if (
      officialWebsite &&
      !this.isAllowedOfficialImageHost(parsed.hostname, officialWebsite)
    ) {
      throw new Error(
        `Image host is not official or allowed CDN: ${parsed.hostname}`,
      );
    }

    const res = await this.fetchWithTimeout(parsed.toString());
    if (!res.ok) throw new Error(`Image returned HTTP ${res.status}`);
    const contentType = res.headers.get('content-type');
    if (!contentType?.startsWith('image/')) {
      throw new Error(`Unsupported content type: ${contentType ?? 'unknown'}`);
    }
    const arrayBuffer = await res.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_IMAGE_BYTES) {
      throw new Error('Image exceeds max bytes');
    }
    const buffer = Buffer.from(arrayBuffer);
    const probe = probeImage(buffer, contentType);
    if (!probe) throw new Error('Could not read image dimensions');
    if (probe.width < MIN_COVER_WIDTH || probe.height < MIN_COVER_HEIGHT) {
      throw new Error(`Image too small: ${probe.width}x${probe.height}`);
    }
    if (isLogoLike(probe.width, probe.height)) {
      throw new Error(
        `Image looks square/logo-like: ${probe.width}x${probe.height}`,
      );
    }
    const hash = createHash('sha256').update(buffer).digest('hex');
    return {
      originalUrl: parsed.toString(),
      sourcePageUrl,
      sourceType: SchoolMediaSourceType.OFFICIAL_WEBSITE,
      width: probe.width,
      height: probe.height,
      hash,
      buffer,
      mimetype: probe.mimetype,
      failureReason: null,
    };
  }

  private async persistCandidate(
    schoolId: string,
    candidate: ImageCandidate,
    forcedStatus?: SchoolMediaStatus,
  ) {
    const existing = candidate.hash
      ? await this.prisma.schoolMediaAsset.findFirst({
          where: {
            schoolId,
            type: SchoolMediaType.CAMPUS_COVER,
            hash: candidate.hash,
          },
        })
      : await this.prisma.schoolMediaAsset.findFirst({
          where: {
            schoolId,
            type: SchoolMediaType.CAMPUS_COVER,
            originalUrl: candidate.originalUrl,
          },
        });
    const canPublish = this.canPersistPublicMedia();
    const canUseExternalOriginal = this.canApproveExternalOriginalUrl(
      candidate.sourceType,
    );
    if (existing) {
      if (
        !canPublish &&
        canUseExternalOriginal &&
        (existing.status === SchoolMediaStatus.CANDIDATE ||
          existing.status === SchoolMediaStatus.PENDING_REVIEW)
      ) {
        await this.setPrimaryTransaction(
          schoolId,
          SchoolMediaType.CAMPUS_COVER,
          existing.id,
          {
            status: SchoolMediaStatus.APPROVED,
            sourceType: candidate.sourceType,
            storageUrl: existing.storageUrl,
            originalUrl: candidate.originalUrl,
            sourcePageUrl: candidate.sourcePageUrl,
            license: candidate.license,
            author: candidate.author,
            attribution: candidate.attribution,
            width: candidate.width,
            height: candidate.height,
            hash: candidate.hash,
            reviewedAt: new Date(),
            failureReason: null,
          },
        );
        await this.schoolWriteService.invalidateSchoolCaches(schoolId);
        return this.requireAsset(existing.id);
      }
      return existing;
    }

    const shouldUpload = canPublish && candidate.buffer && candidate.mimetype;
    const uploaded = shouldUpload
      ? await this.storage.uploadSchoolMedia(
          schoolId,
          SchoolMediaType.CAMPUS_COVER,
          {
            buffer: candidate.buffer!,
            mimetype: candidate.mimetype!,
            originalname: `campus-cover${extFromMime(candidate.mimetype!)}`,
            hash: candidate.hash ?? undefined,
          },
        )
      : null;
    const status =
      forcedStatus ??
      (candidate.sourceType === SchoolMediaSourceType.OFFICIAL_WEBSITE &&
      uploaded
        ? SchoolMediaStatus.APPROVED
        : !canPublish && canUseExternalOriginal
          ? SchoolMediaStatus.APPROVED
          : canPublish
            ? SchoolMediaStatus.PENDING_REVIEW
            : SchoolMediaStatus.CANDIDATE);

    const data: Prisma.SchoolMediaAssetCreateInput = {
      school: { connect: { id: schoolId } },
      type: SchoolMediaType.CAMPUS_COVER,
      status,
      sourceType: candidate.sourceType,
      storageUrl: uploaded?.url,
      originalUrl: candidate.originalUrl,
      sourcePageUrl: candidate.sourcePageUrl,
      license: candidate.license,
      author: candidate.author,
      attribution: candidate.attribution,
      width: candidate.width,
      height: candidate.height,
      hash: candidate.hash,
      isPrimary: status === SchoolMediaStatus.APPROVED,
      reviewedAt:
        status === SchoolMediaStatus.APPROVED ? new Date() : undefined,
      failureReason:
        !canPublish &&
        candidate.sourceType === SchoolMediaSourceType.OFFICIAL_WEBSITE
          ? 'Public media storage is not configured for production'
          : null,
    };

    if (status === SchoolMediaStatus.APPROVED) {
      const created = await this.prisma.$transaction(async (tx) => {
        await tx.schoolMediaAsset.updateMany({
          where: {
            schoolId,
            type: SchoolMediaType.CAMPUS_COVER,
            isPrimary: true,
          },
          data: { isPrimary: false },
        });
        return tx.schoolMediaAsset.create({ data });
      });
      await this.schoolWriteService.invalidateSchoolCaches(schoolId);
      return created;
    }

    return this.prisma.schoolMediaAsset.create({ data });
  }

  private async persistFailure(
    schoolId: string,
    website: string | null,
    reason: string,
  ) {
    return this.prisma.schoolMediaAsset.create({
      data: {
        school: { connect: { id: schoolId } },
        type: SchoolMediaType.CAMPUS_COVER,
        status: SchoolMediaStatus.FAILED,
        sourceType: SchoolMediaSourceType.OFFICIAL_WEBSITE,
        sourcePageUrl: website,
        failureReason: reason.slice(0, 2000),
      },
    });
  }

  private async requireAsset(id: string) {
    const asset = await this.prisma.schoolMediaAsset.findUnique({
      where: { id },
    });
    if (!asset) throw new NotFoundException('School media asset not found');
    return asset;
  }

  private async setPrimaryTransaction(
    schoolId: string,
    type: SchoolMediaType,
    assetId: string,
    data: Prisma.SchoolMediaAssetUpdateInput,
  ) {
    await this.prisma.$transaction([
      this.prisma.schoolMediaAsset.updateMany({
        where: { schoolId, type, isPrimary: true, id: { not: assetId } },
        data: { isPrimary: false },
      }),
      this.prisma.schoolMediaAsset.update({
        where: { id: assetId },
        data: { ...data, isPrimary: true },
      }),
    ]);
  }

  private canPersistPublicMedia(): boolean {
    return (
      this.storage.getStorageType() !== 'local' ||
      this.config.get<string>('NODE_ENV') !== 'production'
    );
  }

  private canApproveExternalOriginalUrl(
    sourceType: SchoolMediaSourceType,
  ): boolean {
    return sourceType === SchoolMediaSourceType.WIKIMEDIA_COMMONS;
  }

  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      return await fetch(url, {
        signal: controller.signal,
        redirect: 'follow',
        headers: { 'user-agent': USER_AGENT, accept: 'text/html,image/*,*/*' },
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  private isAllowedOfficialImageHost(
    imageHost: string,
    officialWebsite: string,
  ): boolean {
    const officialDomain = extractSchoolLogoDomain(officialWebsite);
    if (!officialDomain) return false;
    const normalizedHost = imageHost.toLowerCase();
    if (
      normalizedHost === officialDomain ||
      normalizedHost.endsWith(`.${officialDomain}`)
    ) {
      return true;
    }
    return OFFICIAL_CDN_HOST_PARTS.some((part) =>
      normalizedHost.includes(part),
    );
  }

  private async auditAsset(
    userId: string | undefined,
    action: string,
    assetId: string,
    reason?: string,
  ) {
    await this.auditLog.log({
      userId: userId ?? 'system',
      action: AuditAction.ADMIN_ACTION,
      resource: 'school-media',
      resourceId: assetId,
      metadata: { action, reason },
    });
  }
}
