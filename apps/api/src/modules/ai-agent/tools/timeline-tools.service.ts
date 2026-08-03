/**
 * Timeline Tools Service
 *
 * Tools: GET_DEADLINES, CREATE_TIMELINE, GET_PERSONAL_EVENTS, CREATE_PERSONAL_EVENT
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { LLMService } from '../core/llm.service';
import { SchoolLookupHelper } from './helpers/school-lookup.helper';
import { extractJsonFromLlm } from '../../../common/utils/llm-json.util';
import { ToolHandler, IToolHandlerProvider } from './tool-handler.interface';

@Injectable()
export class TimelineToolsService implements IToolHandlerProvider {
  private readonly logger = new Logger(TimelineToolsService.name);

  constructor(
    private prisma: PrismaService,
    private llmService: LLMService,
    private schoolLookup: SchoolLookupHelper,
  ) {}

  getHandlers(): Map<string, ToolHandler> {
    return new Map([
      [
        'get_deadlines',
        (args, _userId, _ctx, locale) =>
          this.getDeadlines(args.schoolIds?.split(','), args.round, locale),
      ],
      [
        'create_timeline',
        (args, userId, ctx, locale) =>
          this.createTimeline(args, userId, ctx, locale),
      ],
      [
        'get_personal_events',
        (args, userId, _ctx, locale) =>
          this.getPersonalEvents(userId, args.category, locale),
      ],
      [
        'create_personal_event',
        (args, userId, _ctx, locale) =>
          this.createPersonalEvent(userId, args as any, locale),
      ],
    ]);
  }

  async getDeadlines(schoolIds?: string[], round?: string, locale = 'zh') {
    if (!schoolIds?.length) {
      return {
        error: locale === 'zh' ? '请提供学校ID' : 'Please provide school IDs',
      };
    }

    const normalizedRound = round?.trim().toUpperCase();
    const applicationYear = this.getCurrentApplicationYear();
    // governance: system-scope — SchoolDeadline holds scraped application
    // deadlines keyed by schoolId + year, no User relation; the source/notes
    // filters keep it to source-backed rows.
    const deadlineRows = await this.prisma.schoolDeadline.findMany({
      where: {
        schoolId: { in: schoolIds },
        year: applicationYear,
        source: { not: 'MANUAL' },
        notes: { contains: 'source:' },
        ...(normalizedRound ? { round: normalizedRound } : {}),
      },
      orderBy: [{ school: { name: 'asc' } }, { applicationDeadline: 'asc' }],
      select: {
        round: true,
        year: true,
        applicationDeadline: true,
        financialAidDeadline: true,
        decisionDate: true,
        source: true,
        notes: true,
        school: { select: { name: true, nameZh: true } },
      },
    });

    const bySchool = new Map<
      string,
      {
        school: string;
        deadlines: Record<
          string,
          {
            date: string;
            year: number;
            source: string;
            sourceUrl: string | null;
            financialAidDeadline: string | null;
            decisionDate: string | null;
          }
        >;
        sourcePolicy: string;
      }
    >();

    for (const row of deadlineRows) {
      const schoolName = this.schoolLookup.displayName(row.school, locale);
      const bucket = bySchool.get(schoolName) ?? {
        school: schoolName,
        deadlines: {},
        sourcePolicy: 'source_backed_current_year_deadlines',
      };
      bucket.deadlines[row.round] = {
        date: row.applicationDeadline.toISOString(),
        year: row.year,
        source: row.source,
        sourceUrl: this.extractSourceUrl(row.notes),
        financialAidDeadline: row.financialAidDeadline?.toISOString() ?? null,
        decisionDate: row.decisionDate?.toISOString() ?? null,
      };
      bySchool.set(schoolName, bucket);
    }

    return {
      applicationYear,
      sourcePolicy:
        deadlineRows.length > 0
          ? 'source_backed_current_year_deadlines'
          : 'no_source_backed_current_year_deadlines',
      deadlines: Array.from(bySchool.values()),
    };
  }

  async createTimeline(
    args: { targetSchools?: string; startDate?: string },
    userId: string,
    _context: any,
    locale = 'zh',
  ) {
    const isZh = locale === 'zh';
    const systemPrompt = isZh
      ? `你是申请规划顾问。根据目标学校创建详细的申请时间线。

时间线应包括:
1. 标化考试准备和报名
2. 学校研究和选校
3. 文书写作时间
4. 推荐信联系
5. 各轮次申请截止
6. 面试准备

返回JSON格式:
{
  "timeline": [
    { "month": "2025年8月", "tasks": ["任务1", "任务2"] }
  ],
  "keyDates": [
    { "date": "2025-11-01", "event": "ED截止", "schools": ["学校1"] }
  ],
  "tips": ["建议1", "建议2"]
}`
      : `You are an admissions planning consultant. Create a detailed application timeline based on target schools.

The timeline should include:
1. Standardized test preparation and registration
2. School research and selection
3. Essay writing schedule
4. Recommendation letter outreach
5. Application deadlines by round
6. Interview preparation

Return in JSON format:
{
  "timeline": [
    { "month": "August 2025", "tasks": ["Task 1", "Task 2"] }
  ],
  "keyDates": [
    { "date": "2025-11-01", "event": "ED Deadline", "schools": ["School 1"] }
  ],
  "tips": ["Tip 1", "Tip 2"]
}`;

    const result = await this.llmService.chatSimpleGuarded(
      [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: isZh
            ? `目标学校: ${args.targetSchools || '待定'}\n开始日期: ${args.startDate || '现在'}`
            : `Target schools: ${args.targetSchools || 'TBD'}\nStart date: ${args.startDate || 'now'}`,
        },
      ],
      { temperature: 0.6, userId },
    );

    return extractJsonFromLlm(result, 'timeline');
  }

  private getCurrentApplicationYear(now = new Date()) {
    return now.getMonth() >= 7 ? now.getFullYear() + 1 : now.getFullYear();
  }

  private extractSourceUrl(notes?: string | null): string | null {
    if (!notes) return null;
    const match = /source:\s*(https?:\/\/\S+)/i.exec(notes);
    return match ? match[1] : null;
  }

  async getPersonalEvents(userId: string, category?: string, locale = 'zh') {
    const where: any = { userId };
    if (category) {
      where.category = category;
    }

    const events = await this.prisma.personalEvent.findMany({
      where,
      include: { tasks: { orderBy: { sortOrder: 'asc' } } },
      orderBy: [{ priority: 'desc' }, { deadline: 'asc' }],
      take: 20,
    });

    if (!events.length) {
      return {
        message:
          locale === 'zh'
            ? '暂无个人事件，可以通过订阅全局事件或手动创建来添加'
            : 'No personal events. You can subscribe to global events or create new ones.',
      };
    }

    return events.map((e) => ({
      id: e.id,
      title: e.title,
      category: e.category,
      status: e.status,
      progress: e.progress,
      deadline: e.deadline?.toISOString(),
      eventDate: e.eventDate?.toISOString(),
      tasksTotal: e.tasks.length,
      tasksCompleted: e.tasks.filter((t) => t.completed).length,
      tasks: e.tasks.map((t) => ({
        title: t.title,
        completed: t.completed,
        dueDate: t.dueDate?.toISOString(),
      })),
    }));
  }

  async createPersonalEvent(
    userId: string,
    args: {
      title: string;
      category: string;
      deadline?: string;
      eventDate?: string;
      description?: string;
    },
    locale = 'zh',
  ) {
    const isZh = locale === 'zh';
    if (!args.title || !args.category) {
      return {
        error: isZh
          ? '需要提供事件名称和分类'
          : 'Event title and category are required',
      };
    }

    const templates: Record<string, string[]> = isZh
      ? {
          COMPETITION: [
            '了解竞赛规则和要求',
            '报名注册',
            '备赛准备',
            '参加竞赛',
            '查看结果',
          ],
          TEST: [
            '报名注册',
            '制定备考计划',
            '完成模考练习',
            '参加考试',
            '送分',
          ],
          SUMMER_PROGRAM: [
            '研究项目/学校',
            '准备申请材料',
            '提交申请',
            '面试准备',
            '确认录取',
          ],
          INTERNSHIP: [
            '搜索实习机会',
            '准备简历/CV',
            '提交申请',
            '面试准备',
            '确认 Offer',
          ],
          ACTIVITY: [
            '了解活动详情',
            '报名/注册',
            '准备所需材料',
            '参与活动',
            '总结记录',
          ],
          MATERIAL: [
            '确认需要的材料清单',
            '联系相关人员/机构',
            '准备材料内容',
            '提交/寄送',
            '确认收到',
          ],
          OTHER: ['了解详情', '准备', '执行', '完成'],
        }
      : {
          COMPETITION: [
            'Learn rules and requirements',
            'Register',
            'Prepare',
            'Compete',
            'Check results',
          ],
          TEST: [
            'Register',
            'Create study plan',
            'Complete practice tests',
            'Take exam',
            'Send scores',
          ],
          SUMMER_PROGRAM: [
            'Research programs',
            'Prepare application',
            'Submit application',
            'Interview prep',
            'Confirm enrollment',
          ],
          INTERNSHIP: [
            'Search opportunities',
            'Prepare resume/CV',
            'Submit applications',
            'Interview prep',
            'Confirm offer',
          ],
          ACTIVITY: [
            'Learn details',
            'Register',
            'Prepare materials',
            'Participate',
            'Document & reflect',
          ],
          MATERIAL: [
            'Confirm required materials',
            'Contact relevant parties',
            'Prepare content',
            'Submit/send',
            'Confirm receipt',
          ],
          OTHER: ['Learn details', 'Prepare', 'Execute', 'Complete'],
        };

    const taskTitles = templates[args.category] || templates.OTHER;

    // Validate deadline is not in the past (eventDate is allowed to be past for historical records)
    if (args.deadline) {
      const deadlineDate = new Date(args.deadline);
      if (isNaN(deadlineDate.getTime())) {
        return {
          error:
            locale === 'zh' ? '截止日期格式无效' : 'Invalid deadline format',
        };
      }
      if (deadlineDate < new Date()) {
        return {
          error:
            locale === 'zh'
              ? '截止日期已过，无法创建'
              : 'Deadline is in the past',
        };
      }
    }

    const event = await this.prisma.personalEvent.create({
      data: {
        userId,
        title: args.title,
        category: args.category as any,
        deadline: args.deadline ? new Date(args.deadline) : undefined,
        eventDate: args.eventDate ? new Date(args.eventDate) : undefined,
        description: args.description,
        tasks: {
          create: taskTitles.map((title, index) => ({
            title,
            sortOrder: index,
          })),
        },
      },
      include: { tasks: true },
    });

    return {
      success: true,
      event: {
        id: event.id,
        title: event.title,
        category: event.category,
        status: event.status,
        tasksCreated: event.tasks.length,
      },
      message: isZh
        ? `已创建事件「${event.title}」，包含 ${event.tasks.length} 个子任务`
        : `Created event "${event.title}" with ${event.tasks.length} subtasks`,
    };
  }
}
