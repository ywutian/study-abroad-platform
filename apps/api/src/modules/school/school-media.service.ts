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

const MIN_COVER_WIDTH = 600;
const MIN_COVER_HEIGHT = 300;
const FETCH_TIMEOUT_MS = 12_000;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const USER_AGENT =
  'Mozilla/5.0 (compatible; LumniEduSchoolMediaBot/1.0; +https://lumniedu.com)';

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

    const schools = await this.prisma.school.findMany({
      where: {
        ...(dto.schoolId ? { id: dto.schoolId } : {}),
        website: { not: null },
      },
      select: {
        id: true,
        name: true,
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
        { id: school.id, name: school.name, website: school.website },
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
      if (!this.canPersistPublicMedia()) {
        throw new BadRequestException(
          'Public media storage is not configured for production',
        );
      }
      const downloaded = await this.downloadAndValidateCover(
        asset.originalUrl,
        asset.sourcePageUrl ?? asset.originalUrl,
        asset.schoolId,
      );
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
    const status = this.canPersistPublicMedia()
      ? SchoolMediaStatus.APPROVED
      : SchoolMediaStatus.CANDIDATE;
    const uploaded = this.canPersistPublicMedia()
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
    school: { id: string; name: string; website: string | null },
    sources: Array<'official' | 'wikimedia'>,
    dryRun: boolean,
  ) {
    const failures: string[] = [];

    if (sources.includes('official') && school.website) {
      const official = await this.discoverOfficialCover(school).catch(
        (error) => {
          failures.push(String(error instanceof Error ? error.message : error));
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

    if (sources.includes('wikimedia')) {
      const wikimedia = await this.discoverWikimediaCover(school).catch(
        (error) => {
          failures.push(String(error instanceof Error ? error.message : error));
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
          : this.persistCandidate(
              school.id,
              wikimedia,
              SchoolMediaStatus.PENDING_REVIEW,
            );
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
  }): Promise<ImageCandidate | null> {
    const search = encodeURIComponent(`${school.name} campus`);
    const url =
      `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search` +
      `&gsrnamespace=6&gsrlimit=5&gsrsearch=${search}` +
      `&prop=imageinfo&iiprop=url|mime|size|metadata|extmetadata`;
    const res = await this.fetchWithTimeout(url);
    if (!res.ok) throw new Error(`Wikimedia returned HTTP ${res.status}`);
    const data = (await res.json()) as {
      query?: {
        pages?: Record<
          string,
          {
            imageinfo?: Array<{
              url?: string;
              descriptionurl?: string;
              mime?: string;
              width?: number;
              height?: number;
              extmetadata?: Record<string, { value?: string }>;
            }>;
          }
        >;
      };
    };

    for (const page of Object.values(data.query?.pages ?? {})) {
      const info = page.imageinfo?.[0];
      if (!info?.url || !info.descriptionurl) continue;
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
      return {
        originalUrl: info.url,
        sourcePageUrl: info.descriptionurl,
        sourceType: SchoolMediaSourceType.WIKIMEDIA_COMMONS,
        license,
        author,
        attribution,
        width: info.width,
        height: info.height,
      };
    }
    return null;
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
    if (existing) return existing;

    const canPublish = this.canPersistPublicMedia();
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
