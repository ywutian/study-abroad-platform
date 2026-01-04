import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * College Scorecard API 数据同步服务
 * 
 * 数据源: 美国教育部官方数据
 * API 文档: https://collegescorecard.ed.gov/data/documentation/
 * 
 * 免费获取 API Key: https://api.data.gov/signup/
 */
@Injectable()
export class SchoolDataService {
  private readonly logger = new Logger(SchoolDataService.name);
  private readonly apiKey: string | undefined;
  private readonly baseUrl = 'https://api.data.gov/ed/collegescorecard/v1/schools';

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    this.apiKey = this.configService.get<string>('COLLEGE_SCORECARD_API_KEY');
  }

  /**
   * 从 College Scorecard 同步学校数据
   */
  async syncSchoolsFromScorecard(limit = 100): Promise<{ synced: number; errors: number }> {
    if (!this.apiKey) {
      throw new Error('COLLEGE_SCORECARD_API_KEY not configured');
    }

    const fields = [
      'id',
      'school.name',
      'school.city',
      'school.state',
      'school.school_url',
      'school.ownership', // 1=public, 2=private nonprofit, 3=private for-profit
      'latest.admissions.admission_rate.overall',
      'latest.admissions.sat_scores.average.overall',
      'latest.admissions.act_scores.midpoint.cumulative',
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
          throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        const schools = data.results || [];

        if (schools.length === 0) break;

        for (const school of schools) {
          if (synced >= limit) break;

          try {
            await this.upsertSchool(school);
            synced++;
          } catch (err) {
            this.logger.error(`Failed to upsert school: ${school['school.name']}`, err);
            errors++;
          }
        }

        page++;
        
        // Rate limiting: 1 request per second
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      this.logger.log(`Sync completed: ${synced} schools synced, ${errors} errors`);
      return { synced, errors };

    } catch (error) {
      this.logger.error('Sync failed', error);
      throw error;
    }
  }

  private async upsertSchool(data: Record<string, unknown>) {
    const scorecardId = String(data['id']);
    const name = data['school.name'] as string;

    if (!name) return;

    const schoolData = {
      name,
      country: 'US',
      state: data['school.state'] as string || null,
      city: data['school.city'] as string || null,
      website: data['school.school_url'] as string || null,
      acceptanceRate: data['latest.admissions.admission_rate.overall'] 
        ? Number(data['latest.admissions.admission_rate.overall']) * 100 
        : null,
      satAvg: data['latest.admissions.sat_scores.average.overall'] as number || null,
      actAvg: data['latest.admissions.act_scores.midpoint.cumulative'] as number || null,
      tuition: data['latest.cost.tuition.out_of_state'] as number || null,
      studentCount: data['latest.student.size'] as number || null,
      graduationRate: data['latest.completion.completion_rate_4yr_150nt']
        ? Number(data['latest.completion.completion_rate_4yr_150nt']) * 100
        : null,
      avgSalary: data['latest.earnings.10_yrs_after_entry.median'] as number || null,
    };

    // Upsert by scorecard ID stored in metadata
    const existing = await this.prisma.school.findFirst({
      where: { 
        OR: [
          { name: name },
          { metadata: { path: ['scorecardId'], equals: scorecardId } }
        ]
      },
    });

    if (existing) {
      await this.prisma.school.update({
        where: { id: existing.id },
        data: {
          ...schoolData,
          metadata: { scorecardId },
        },
      });
    } else {
      await this.prisma.school.create({
        data: {
          ...schoolData,
          metadata: { scorecardId },
        },
      });
    }
  }

  /**
   * 获取特定学校的详细数据
   */
  async getSchoolDetails(scorecardId: string) {
    if (!this.apiKey) {
      throw new Error('COLLEGE_SCORECARD_API_KEY not configured');
    }

    const url = `${this.baseUrl}?api_key=${this.apiKey}&id=${scorecardId}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return data.results?.[0] || null;
  }
}




