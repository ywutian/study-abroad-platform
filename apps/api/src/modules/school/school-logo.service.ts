import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { SchoolService } from './school.service';
import {
  AuditLogService,
  AuditAction,
} from '../../common/services/audit-log.service';

const LOGO_DEV_BASE = 'https://img.logo.dev';

/**
 * Extract hostname from school website for Logo.dev.
 * Returns null for invalid or non-public domains.
 */
export function extractDomainForLogo(
  website: string | null | undefined,
): string | null {
  if (!website || typeof website !== 'string') return null;
  const trimmed = website.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  if (!host || host === 'localhost' || host.endsWith('.localhost')) return null;
  if (host.startsWith('www.')) return host.slice(4);
  return host;
}

@Injectable()
export class SchoolLogoService {
  private readonly logger = new Logger(SchoolLogoService.name);
  private readonly token: string | undefined;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly schoolService: SchoolService,
    private readonly auditLogService: AuditLogService,
  ) {
    this.token = this.configService.get<string>('LOGO_DEV_TOKEN');
  }

  isConfigured(): boolean {
    return !!this.token?.trim();
  }

  /**
   * Build Logo.dev image URL for a domain. Returns null if token not configured.
   */
  getLogoUrlForDomain(domain: string): string | null {
    if (!this.isConfigured()) return null;
    return `${LOGO_DEV_BASE}/${domain}?token=${this.token}&size=256`;
  }

  /**
   * Get suggested logo URL for a school with website. Returns null if no website or not configured.
   */
  getSuggestedLogoUrl(website: string | null | undefined): string | null {
    const domain = extractDomainForLogo(website);
    if (!domain) return null;
    return this.getLogoUrlForDomain(domain);
  }

  /**
   * Fill logoUrl for schools that have website but no logoUrl, using Logo.dev.
   * Rate limit ~300ms per school. Returns counts and writes audit log.
   */
  async fillLogosByDomain(
    limit: number,
    userId: string,
  ): Promise<{
    filled: number;
    failed: number;
    skipped: number;
    message?: string;
  }> {
    if (!this.isConfigured()) {
      return {
        filled: 0,
        failed: 0,
        skipped: 0,
        message: 'LOGO_DEV_TOKEN is not configured',
      };
    }

    const cap = Math.min(Math.max(1, limit), 500);
    const schools = await this.prisma.school.findMany({
      where: {
        website: { not: null },
        logoUrl: null,
      },
      select: { id: true, name: true, website: true },
      take: cap,
    });

    let filled = 0;
    let failed = 0;

    for (const school of schools) {
      const domain = extractDomainForLogo(school.website);
      if (!domain) {
        failed++;
        continue;
      }
      const logoUrl = this.getLogoUrlForDomain(domain);
      if (!logoUrl) {
        failed++;
        continue;
      }
      try {
        await this.prisma.school.update({
          where: { id: school.id },
          data: { logoUrl },
        });
        await this.schoolService.invalidateSchoolCache(school.id);
        filled++;
      } catch (err) {
        this.logger.warn(
          `Failed to update logo for school ${school.id}: ${err}`,
        );
        failed++;
      }
      await new Promise((r) => setTimeout(r, 300));
    }

    await this.auditLogService.log({
      userId,
      action: AuditAction.ADMIN_ACTION,
      resource: 'schools',
      resourceId: '',
      metadata: {
        action: 'LOGO_FILL_BY_DOMAIN',
        filled,
        failed,
        total: schools.length,
        limit: cap,
      },
    });

    return {
      filled,
      failed,
      skipped: cap - schools.length,
      message:
        schools.length === 0
          ? 'No schools with website and no logo found'
          : undefined,
    };
  }
}
