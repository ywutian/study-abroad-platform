import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { SchoolService } from './school.service';
import { normalizeSchoolName } from '../../common/utils/school-name.util';
import { normalizePercentRate } from '../../common/utils/percent.util';
import { DataSource, SchoolDataMerger } from './school-data-merger';
import { buildFieldProvenanceRecord } from './school-provenance.helpers';
import { writeSchoolCreate, writeSchoolUpdate } from './school-write.service';

/**
 * College Scorecard API 数据同步服务
 *
 * 数据源: 美国教育部官方数据
 * API 文档: https://collegescorecard.ed.gov/data/documentation/
 *
 * 免费获取 API Key: https://api.data.gov/signup/
 */

const SCORECARD_WRITABLE_FIELDS = new Set([
  'name',
  'state',
  'city',
  'website',
  'acceptanceRate',
  'satAvg',
  'sat25',
  'sat75',
  'satMath25',
  'satMath75',
  'satReading25',
  'satReading75',
  'actAvg',
  'act25',
  'act75',
  'tuition',
  'studentCount',
  'graduationRate',
  'avgSalary',
]);
@Injectable()
export class SchoolDataService {
  private readonly logger = new Logger(SchoolDataService.name);
  private readonly apiKey: string | undefined;
  private readonly baseUrl =
    'https://api.data.gov/ed/collegescorecard/v1/schools';

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private schoolService: SchoolService,
    private merger: SchoolDataMerger,
  ) {
    this.apiKey = this.configService.get<string>('COLLEGE_SCORECARD_API_KEY');
  }

  /**
   * 从 College Scorecard 同步学校数据
   */
  async syncSchoolsFromScorecard(
    limit = 100,
  ): Promise<{ synced: number; errors: number }> {
    if (!this.apiKey) {
      throw new InternalServerErrorException(
        'COLLEGE_SCORECARD_API_KEY not configured',
      );
    }

    const fields = [
      'id',
      'school.name',
      'school.city',
      'school.state',
      'school.school_url',
      'school.ownership', // 1=public, 2=private nonprofit, 3=private for-profit
      'latest.admissions.admission_rate.overall',
      // SAT scores
      'latest.admissions.sat_scores.average.overall',
      'latest.admissions.sat_scores.25th_percentile.critical_reading',
      'latest.admissions.sat_scores.75th_percentile.critical_reading',
      'latest.admissions.sat_scores.25th_percentile.math',
      'latest.admissions.sat_scores.75th_percentile.math',
      // ACT scores
      'latest.admissions.act_scores.midpoint.cumulative',
      'latest.admissions.act_scores.25th_percentile.cumulative',
      'latest.admissions.act_scores.75th_percentile.cumulative',
      // Cost, enrollment, outcomes
      'latest.cost.tuition.in_state',
      'latest.cost.tuition.out_of_state',
      'latest.student.size',
      'latest.completion.completion_rate_4yr_150nt',
      'latest.earnings.10_yrs_after_entry.median',
    ].join(',');

    let synced = 0;
    let errors = 0;
    let page = 0;
    const perPage = 100;

    try {
      while (synced < limit) {
        const url = `${this.baseUrl}?api_key=${this.apiKey}&school.operating=1&school.degrees_awarded.predominant=3&fields=${fields}&per_page=${perPage}&page=${page}`;

        this.logger.log(`Fetching page ${page}...`);

        const response = await fetch(url);
        if (!response.ok) {
          throw new InternalServerErrorException(
            `API error: ${response.status}`,
          );
        }

        const data = await response.json();
        const schools = data.results || [];

        if (schools.length === 0) break;

        for (const school of schools) {
          if (synced >= limit) break;

          try {
            const schoolId = await this.upsertSchool(school);
            if (schoolId) {
              await this.schoolService.invalidateSchoolCache(schoolId);
            }
            synced++;
          } catch (err) {
            this.logger.error(
              `Failed to upsert school: ${school['school.name']}`,
              err,
            );
            errors++;
          }
        }

        page++;

        // Rate limiting: 1 request per second
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      this.logger.log(
        `Sync completed: ${synced} schools synced, ${errors} errors`,
      );
      return { synced, errors };
    } catch (error) {
      this.logger.error('Sync failed', error);
      throw error;
    }
  }

  /**
   * Upsert a school from Scorecard payload. Returns the school id for cache invalidation.
   */
  private async upsertSchool(
    data: Record<string, unknown>,
  ): Promise<string | null> {
    const scorecardId = String(data['id']);
    const name = data['school.name'] as string;

    if (!name) return null;

    // Parse SAT sub-score percentiles
    const satReading25 =
      (data[
        'latest.admissions.sat_scores.25th_percentile.critical_reading'
      ] as number) || null;
    const satReading75 =
      (data[
        'latest.admissions.sat_scores.75th_percentile.critical_reading'
      ] as number) || null;
    const satMath25 =
      (data['latest.admissions.sat_scores.25th_percentile.math'] as number) ||
      null;
    const satMath75 =
      (data['latest.admissions.sat_scores.75th_percentile.math'] as number) ||
      null;

    // Compute combined SAT 25th/75th from sub-scores
    const sat25 = satReading25 && satMath25 ? satReading25 + satMath25 : null;
    const sat75 = satReading75 && satMath75 ? satReading75 + satMath75 : null;

    const schoolData = {
      name,
      country: 'US',
      state: (data['school.state'] as string) || null,
      city: (data['school.city'] as string) || null,
      website: (data['school.school_url'] as string) || null,
      acceptanceRate: normalizePercentRate(
        data['latest.admissions.admission_rate.overall'],
      ),
      // SAT scores
      satAvg:
        (data['latest.admissions.sat_scores.average.overall'] as number) ||
        null,
      sat25,
      sat75,
      satMath25,
      satMath75,
      satReading25,
      satReading75,
      // ACT scores
      actAvg:
        (data['latest.admissions.act_scores.midpoint.cumulative'] as number) ||
        null,
      act25:
        (data[
          'latest.admissions.act_scores.25th_percentile.cumulative'
        ] as number) || null,
      act75:
        (data[
          'latest.admissions.act_scores.75th_percentile.cumulative'
        ] as number) || null,
      // Cost, enrollment, outcomes
      tuition: (data['latest.cost.tuition.out_of_state'] as number) || null,
      studentCount: (data['latest.student.size'] as number) || null,
      graduationRate: normalizePercentRate(
        data['latest.completion.completion_rate_4yr_150nt'],
      ),
      avgSalary:
        (data['latest.earnings.10_yrs_after_entry.median'] as number) || null,
    };
    const scorecardMergeData = Object.fromEntries(
      Object.entries(schoolData).filter(
        ([key, value]) => value != null && SCORECARD_WRITABLE_FIELDS.has(key),
      ),
    );

    const nameNorm = normalizeSchoolName(name);

    const existing =
      (await this.prisma.school.findUnique({ where: { scorecardId } })) ??
      (await this.prisma.school.findUnique({ where: { nameNorm } }));

    const fetchedAt = new Date().toISOString();
    const scorecardIdProvenance = buildFieldProvenanceRecord(['scorecardId'], {
      source: 'COLLEGE_SCORECARD',
      fetchedAt,
    });

    let schoolIdOut: string | null = null;

    if (existing) {
      await writeSchoolUpdate(this.prisma, existing.id, {
        fields: { scorecardId },
        metadataPatch: { scorecardId },
        provenance: scorecardIdProvenance,
        existingMetadata: existing.metadata,
      });
      schoolIdOut = existing.id;
    } else {
      const created = await writeSchoolCreate(this.prisma, {
        fields: {
          name,
          country: 'US',
          scorecardId,
        },
        metadataPatch: { scorecardId },
        provenance: scorecardIdProvenance,
      });
      schoolIdOut = created.id;
    }

    // Write yearly snapshots to SchoolMetric
    const year = new Date().getFullYear();
    const metricEntries: { key: string; value: number | null }[] = [
      { key: 'avg_sat', value: schoolData.satAvg },
      { key: 'sat_25', value: schoolData.sat25 },
      { key: 'sat_75', value: schoolData.sat75 },
      { key: 'avg_act', value: schoolData.actAvg },
      { key: 'act_25', value: schoolData.act25 },
      { key: 'act_75', value: schoolData.act75 },
      {
        key: 'acceptance_rate',
        value: schoolData.acceptanceRate
          ? Number(schoolData.acceptanceRate)
          : null,
      },
    ];

    for (const entry of metricEntries) {
      if (entry.value == null || !schoolIdOut) continue;
      await this.prisma.schoolMetric.upsert({
        where: {
          schoolId_year_metricKey: {
            schoolId: schoolIdOut,
            year,
            metricKey: entry.key,
          },
        },
        create: {
          schoolId: schoolIdOut,
          year,
          metricKey: entry.key,
          value: entry.value,
        },
        update: {
          value: entry.value,
        },
      });
    }

    if (schoolIdOut && Object.keys(scorecardMergeData).length > 0) {
      await this.merger.merge(
        schoolIdOut,
        scorecardMergeData,
        DataSource.COLLEGE_SCORECARD,
      );
    }

    return schoolIdOut;
  }

  /**
   * 获取特定学校的详细数据
   */
  async getSchoolDetails(scorecardId: string) {
    if (!this.apiKey) {
      throw new InternalServerErrorException(
        'COLLEGE_SCORECARD_API_KEY not configured',
      );
    }

    const url = `${this.baseUrl}?api_key=${this.apiKey}&id=${scorecardId}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new InternalServerErrorException(`API error: ${response.status}`);
    }

    const data = await response.json();
    return data.results?.[0] || null;
  }
}
