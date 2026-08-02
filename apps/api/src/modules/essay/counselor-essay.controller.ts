import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiQuery,
} from '@nestjs/swagger';
import { Role, Prisma } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ThrottleRelaxed } from '../../common/decorators/throttle.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import {
  GALLERY_LIST_SELECT,
  CASE_PUBLIC_WHERE,
} from './constants/essay-gallery.constants';
import { parseEssayProvenance } from '@study-abroad/shared';

/**
 * Counselor-only pattern-search workbench.
 *
 * This is the B2B "暗线" surface exposed to verified counselors: the same
 * gallery rows the public sees, but in a denser tabular shape with cross-
 * essay filters (school, result, essayType, archive). Saved-queries and
 * lesson-plan export are scaffolded UI placeholders — Phase 2.
 *
 * Hard gate:
 *   - JWT auth required.
 *   - `@Roles(Role.COUNSELOR, Role.ADMIN, Role.SUPER_ADMIN)` — note the
 *     guard short-circuits on SUPER_ADMIN regardless of the list.
 *   - OPERATOR is NOT admitted; pattern-search is editorial-sensitive
 *     and we don't want data-entry interns reading every essay.
 */
@ApiTags('counselor-essay')
@ApiBearerAuth()
@Controller('counselor/essay-patterns')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.COUNSELOR, Role.ADMIN, Role.SUPER_ADMIN)
@ThrottleRelaxed()
export class CounselorEssayController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Tabular pattern-search across published essays.
   *
   * Returns a flat list ordered by school + year (so a counselor can scan
   * "MIT 2024 admits" as one block). Page size capped at 100 — the UI is
   * a workbench, not an unbounded export. For a real export the user
   * clicks the placeholder PDF button (Phase 2).
   */
  @Get()
  @ApiOperation({ summary: 'Pattern-search essays for counselors (B2B)' })
  @ApiQuery({ name: 'school', required: false })
  @ApiQuery({
    name: 'result',
    required: false,
    description: 'ADMITTED, REJECTED, WAITLISTED',
  })
  @ApiQuery({ name: 'essayType', required: false })
  @ApiQuery({
    name: 'archive',
    required: false,
    description: 'Filter by source archive host',
  })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  async searchPatterns(
    @Query('school') school?: string,
    @Query('result') result?: string,
    @Query('essayType') essayType?: string,
    @Query('archive') archive?: string,
    @Query('page') pageStr?: string,
    @Query('pageSize') pageSizeStr?: string,
  ) {
    const page = pageStr ? Math.max(1, parseInt(pageStr, 10)) : 1;
    const pageSize = pageSizeStr
      ? Math.min(100, Math.max(1, parseInt(pageSizeStr, 10)))
      : 50;

    // Spread the constant instead of restating it. These three clauses were a
    // hand-copy of CASE_PUBLIC_WHERE, with a `void CASE_PUBLIC_WHERE;` further
    // down standing in for the link — which imported the constant, referenced
    // it, and applied none of it. The filter was correct, but only because the
    // copy happened to still match: add a Visibility value or a review status
    // to the constant and this counselor surface keeps the old set silently,
    // while the `void` line goes on implying they are in sync.
    const where: Prisma.AdmissionCaseWhereInput = { ...CASE_PUBLIC_WHERE };
    if (school) {
      where.school = {
        OR: [
          { name: { contains: school, mode: 'insensitive' } },
          { nameZh: { contains: school, mode: 'insensitive' } },
        ],
      };
    }
    if (
      result &&
      ['ADMITTED', 'REJECTED', 'WAITLISTED', 'DEFERRED'].includes(result)
    ) {
      where.result = result as
        'ADMITTED' | 'REJECTED' | 'WAITLISTED' | 'DEFERRED';
    }
    if (
      essayType &&
      ['COMMON_APP', 'UC', 'SUPPLEMENTAL', 'WHY_SCHOOL', 'OTHER'].includes(
        essayType,
      )
    ) {
      where.essayType = essayType as
        'COMMON_APP' | 'UC' | 'SUPPLEMENTAL' | 'WHY_SCHOOL' | 'OTHER';
    }
    if (archive) {
      where.sourceArchive = archive;
    }
    const [cases, total] = await Promise.all([
      // governance: public-feed — `where` spreads CASE_PUBLIC_WHERE; see the note above it
      this.prisma.admissionCase.findMany({
        where,
        select: GALLERY_LIST_SELECT,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [
          { school: { name: 'asc' } },
          { year: 'desc' },
          { createdAt: 'desc' },
        ],
      }),
      // governance: public-feed — `where` spreads CASE_PUBLIC_WHERE; see the note above it
      this.prisma.admissionCase.count({ where }),
    ]);

    const items = cases.map((c) => {
      const provenance =
        c.sourceArchive || c.sourceUrl
          ? {
              archive: c.sourceArchive ?? null,
              url: c.sourceUrl ?? null,
              author: c.sourceAuthor ?? null,
            }
          : parseEssayProvenance(c.tags);
      const hook = (c.essayContent ?? '')
        .slice(0, 140)
        .replace(/\s+/g, ' ')
        .trim();
      return {
        id: c.id,
        school: c.school,
        year: c.year,
        result: c.result,
        essayType: c.essayType,
        promptNumber: c.promptNumber,
        promptExcerpt: c.essayPrompt ? c.essayPrompt.slice(0, 120) : null,
        hookExcerpt: hook ? `${hook}…` : null,
        isVerified: c.isVerified,
        sourceArchive: provenance.archive,
        sourceUrl: provenance.url,
        sourceAuthor: provenance.author,
      };
    });

    // Distinct archive list — drives the autocomplete in the filter bar.
    // Cheap because we already have all sourceArchive values cached on the row.
    // The second hand-copy, and this one had already drifted: it restated
    // visibility + essayContent but dropped `reviewStatus`, so the archive
    // autocomplete was built from unapproved cases too. Only distinct archive
    // hostnames leak that way, which is why nobody noticed — the point is that
    // a copy diverged, exactly as a copy does.
    // governance: public-feed — spreads CASE_PUBLIC_WHERE
    const archiveRows = await this.prisma.admissionCase.findMany({
      where: {
        ...CASE_PUBLIC_WHERE,
        sourceArchive: { not: null },
      },
      select: { sourceArchive: true },
      distinct: ['sourceArchive'],
      take: 50,
    });

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      archives: archiveRows
        .map((r) => r.sourceArchive)
        .filter((a): a is string => Boolean(a))
        .sort(),
    };
  }
}
