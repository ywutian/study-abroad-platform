import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { SchoolService } from './school.service';
import {
  AuditLogService,
  AuditAction,
} from '../../common/services/audit-log.service';
import {
  extractSchoolLogoDomain,
  getSchoolFaviconUrl,
  getSchoolLogoDevUrl,
  isValidSchoolLogoUrl,
} from '../../common/utils/school-logo.util';
import { buildFieldProvenanceRecord } from './school-provenance.helpers';
import { SchoolWriteService } from './school-write.service';

/**
 * Extract hostname from school website for Logo.dev.
 * Returns null for invalid or non-public domains.
 */
export function extractDomainForLogo(
  website: string | null | undefined,
): string | null {
  return extractSchoolLogoDomain(website);
}

@Injectable()
export class SchoolLogoService {
  private readonly logger = new Logger(SchoolLogoService.name);
  private readonly token: string | undefined;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly schoolService: SchoolService,
    private readonly schoolWriteService: SchoolWriteService,
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
    return getSchoolLogoDevUrl(domain, this.token);
  }

  /**
   * Get suggested logo URL for a school with website.
   * Falls back to Google favicon when Logo.dev is unavailable.
   */
  getSuggestedLogoUrl(website: string | null | undefined): string | null {
    const domain = extractDomainForLogo(website);
    if (!domain) return null;
    return this.getLogoUrlForDomain(domain) ?? getSchoolFaviconUrl(website);
  }

  /**
   * Fill logoUrl for schools that have website but no valid logoUrl.
   * Uses Logo.dev when token is configured, otherwise falls back to Google favicon.
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
    const cap = Math.min(Math.max(1, limit), 500);
    const schools = (
      await this.prisma.school.findMany({
        where: {
          website: { not: null },
        },
        select: { id: true, name: true, website: true, logoUrl: true },
        take: cap * 2,
      })
    )
      .filter((school) => !isValidSchoolLogoUrl(school.logoUrl))
      .slice(0, cap);

    let filled = 0;
    let failed = 0;

    for (const school of schools) {
      const logoUrl = this.getSuggestedLogoUrl(school.website);
      if (!logoUrl) {
        failed++;
        continue;
      }
      try {
        await this.schoolWriteService.update(school.id, {
          fields: { logoUrl },
          provenance: buildFieldProvenanceRecord(['logoUrl'], {
            source: 'SCRAPER',
            fetchedAt: new Date().toISOString(),
          }),
        });
        await this.schoolService.invalidateSchoolCache(school.id);
        filled++;
      } catch (err) {
        this.logger.warn(
          `Failed to update logo for school ${school.id}: ${String(err)}`,
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
