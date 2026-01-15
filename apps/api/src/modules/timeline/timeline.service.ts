import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ApplicationStatus,
  PersonalEventStatus,
  PersonalEventCategory,
} from '@prisma/client';
import { TaskType } from '../../common/types/enums';
import {
  CreateTimelineDto,
  UpdateTimelineDto,
  TimelineResponseDto,
  CreateTaskDto,
  UpdateTaskDto,
  TaskResponseDto,
  GenerateTimelineDto,
  TimelineOverviewDto,
  ApplicationRound,
  CreatePersonalEventDto,
  UpdatePersonalEventDto,
  SubscribeGlobalEventDto,
  PersonalEventResponseDto,
  CreatePersonalTaskDto,
  PersonalTaskResponseDto,
} from './dto';

// 默认任务模板
const DEFAULT_TASKS = [
  {
    title: '完成 Common App 主文书',
    type: TaskType.ESSAY,
    essayPrompt: 'Common App Personal Statement',
    wordLimit: 650,
  },
  { title: '完成学校补充文书', type: TaskType.ESSAY },
  { title: '提交成绩单', type: TaskType.DOCUMENT },
  { title: '提交标化成绩', type: TaskType.TEST },
  { title: '获取推荐信', type: TaskType.RECOMMENDATION },
  { title: '填写申请表格', type: TaskType.OTHER },
  { title: '支付申请费', type: TaskType.OTHER },
];

@Injectable()
export class TimelineService {
  private readonly logger = new Logger(TimelineService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * 创建单个时间线
   */
  async createTimeline(
    userId: string,
    dto: CreateTimelineDto,
  ): Promise<TimelineResponseDto> {
    // 检查学校是否存在
    const school = await this.prisma.school.findUnique({
      where: { id: dto.schoolId },
    });

    if (!school) {
      throw new NotFoundException('学校不存在');
    }

    // 检查是否已存在相同的时间线
    const existing = await this.prisma.applicationTimeline.findUnique({
      where: {
        userId_schoolId_round: {
          userId,
          schoolId: dto.schoolId,
          round: dto.round,
        },
      },
    });

    if (existing) {
      throw new ConflictException('该学校的此轮次申请已存在');
    }

    const timeline = await this.prisma.applicationTimeline.create({
      data: {
        userId,
        schoolId: dto.schoolId,
        schoolName: school.nameZh || school.name,
        round: dto.round,
        deadline: dto.deadline ? new Date(dto.deadline) : undefined,
        priority: dto.priority || 0,
        notes: dto.notes,
        tasks: {
          create: DEFAULT_TASKS.map((task, index) => ({
            ...task,
            sortOrder: index,
          })),
        },
      },
      include: {
        tasks: true,
      },
    });

    return this.mapTimelineToResponse(timeline);
  }

  /**
   * 批量智能生成时间线
   *
   * 数据优先级: SchoolDeadline 表 > School.metadata > 默认值
   * 自动根据每所学校的截止日期生成对应轮次的时间线和文书任务
   */
  async generateTimelines(
    userId: string,
    dto: GenerateTimelineDto,
  ): Promise<TimelineResponseDto[]> {
    const results: TimelineResponseDto[] = [];
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const applicationYear =
      currentMonth >= 8 ? now.getFullYear() + 1 : now.getFullYear();

    for (const schoolId of dto.schoolIds) {
      try {
        const school = await this.prisma.school.findUnique({
          where: { id: schoolId },
          include: {
            deadlines: {
              where: { year: applicationYear },
              orderBy: { applicationDeadline: 'asc' },
            },
          },
        });

        if (!school) continue;

        // 检查是否已存在任何时间线
        const existingTimelines =
          await this.prisma.applicationTimeline.findMany({
            where: { userId, schoolId },
            select: { round: true },
          });
        const existingRounds = new Set(existingTimelines.map((t) => t.round));

        // 1. 优先使用 SchoolDeadline 表数据
        if (school.deadlines && school.deadlines.length > 0) {
          for (const dl of school.deadlines) {
            if (existingRounds.has(dl.round)) continue;

            const tasks = this.buildSmartTasks(
              dl.round,
              dl.essayPrompts,
              dl.essayCount,
            );
            const timeline = await this.prisma.applicationTimeline.create({
              data: {
                userId,
                schoolId,
                schoolName: school.nameZh || school.name,
                round: dl.round,
                deadline: dl.applicationDeadline,
                tasks: { create: tasks },
              },
              include: { tasks: true },
            });
            results.push(this.mapTimelineToResponse(timeline));
            existingRounds.add(dl.round);
          }
        }

        // 2. 兜底: 从 metadata JSON 提取截止日期
        if (results.filter((r) => r.schoolId === schoolId).length === 0) {
          const metadata = school.metadata as Record<string, any> | null;
          const deadlines = metadata?.deadlines as
            | Record<string, string>
            | undefined;

          if (deadlines && Object.keys(deadlines).length > 0) {
            for (const [roundKey, dateStr] of Object.entries(deadlines)) {
              const round = roundKey.toUpperCase();
              if (existingRounds.has(round)) continue;

              const parsedDate = this.parseMetadataDate(
                dateStr,
                applicationYear,
              );
              const tasks = this.buildSmartTasks(
                round,
                metadata?.essayPrompts,
                null,
              );
              const timeline = await this.prisma.applicationTimeline.create({
                data: {
                  userId,
                  schoolId,
                  schoolName: school.nameZh || school.name,
                  round,
                  deadline: parsedDate,
                  tasks: { create: tasks },
                },
                include: { tasks: true },
              });
              results.push(this.mapTimelineToResponse(timeline));
              existingRounds.add(round);
            }
          }
        }

        // 3. 最终兜底: 创建默认 RD 时间线
        if (
          results.filter((r) => r.schoolId === schoolId).length === 0 &&
          !existingRounds.has('RD')
        ) {
          const defaultDeadline = new Date(applicationYear, 0, 1); // January 1
          const timeline = await this.prisma.applicationTimeline.create({
            data: {
              userId,
              schoolId,
              schoolName: school.nameZh || school.name,
              round: 'RD',
              deadline: defaultDeadline,
              tasks: {
                create: DEFAULT_TASKS.map((task, index) => ({
                  ...task,
                  sortOrder: index,
                })),
              },
            },
            include: { tasks: true },
          });
          results.push(this.mapTimelineToResponse(timeline));
        }
      } catch (error) {
        this.logger.warn(
          `Failed to create timeline for school ${schoolId}`,
          error,
        );
      }
    }

    return results;
  }

  /**
   * 根据轮次和文书数据，构建智能任务列表
   */
  private buildSmartTasks(
    round: string,
    essayPrompts: any,
    essayCount: number | null,
  ) {
    const tasks: Array<{
      title: string;
      type: TaskType;
      essayPrompt?: string;
      wordLimit?: number;
      sortOrder: number;
    }> = [];

    let sortOrder = 0;

    // 基础任务
    tasks.push({
      title: '填写申请表格',
      type: TaskType.OTHER,
      sortOrder: sortOrder++,
    });
    tasks.push({
      title: '提交成绩单',
      type: TaskType.DOCUMENT,
      sortOrder: sortOrder++,
    });
    tasks.push({
      title: '提交标化成绩',
      type: TaskType.TEST,
      sortOrder: sortOrder++,
    });
    tasks.push({
      title: '获取推荐信',
      type: TaskType.RECOMMENDATION,
      sortOrder: sortOrder++,
    });

    // Common App 主文书（所有轮次都需要）
    tasks.push({
      title: '完成 Common App 主文书',
      type: TaskType.ESSAY,
      essayPrompt: 'Common App Personal Statement',
      wordLimit: 650,
      sortOrder: sortOrder++,
    });

    // 根据文书数据生成补充文书任务
    if (Array.isArray(essayPrompts) && essayPrompts.length > 0) {
      for (const ep of essayPrompts) {
        const prompt = typeof ep === 'string' ? ep : ep?.prompt || '补充文书';
        const wordLimit = typeof ep === 'object' ? ep?.wordLimit : undefined;
        tasks.push({
          title: `补充文书: ${prompt.substring(0, 60)}${prompt.length > 60 ? '...' : ''}`,
          type: TaskType.ESSAY,
          essayPrompt: prompt,
          wordLimit: wordLimit || 250,
          sortOrder: sortOrder++,
        });
      }
    } else {
      // 根据文书数量生成占位任务
      const count = essayCount || 1;
      for (let i = 0; i < count; i++) {
        tasks.push({
          title: `完成学校补充文书 ${count > 1 ? `#${i + 1}` : ''}`.trim(),
          type: TaskType.ESSAY,
          sortOrder: sortOrder++,
        });
      }
    }

    // 申请费
    tasks.push({
      title: '支付申请费',
      type: TaskType.OTHER,
      sortOrder: sortOrder++,
    });

    return tasks;
  }

  /**
   * 解析 metadata 中 "November 1" / "Jan 15" 格式的日期
   */
  private parseMetadataDate(dateStr: string, applicationYear: number): Date {
    const months: Record<string, number> = {
      january: 0,
      february: 1,
      march: 2,
      april: 3,
      may: 4,
      june: 5,
      july: 6,
      august: 7,
      september: 8,
      october: 9,
      november: 10,
      december: 11,
      jan: 0,
      feb: 1,
      mar: 2,
      apr: 3,
      jun: 5,
      jul: 6,
      aug: 7,
      sep: 8,
      oct: 9,
      nov: 10,
      dec: 11,
    };

    const match = dateStr.trim().match(/^([A-Za-z]+)\s+(\d{1,2})$/);
    if (match) {
      const monthNum = months[match[1].toLowerCase()];
      if (monthNum !== undefined) {
        const day = parseInt(match[2]);
        const dateYear = monthNum >= 8 ? applicationYear - 1 : applicationYear;
        return new Date(dateYear, monthNum, day);
      }
    }

    // 无法解析时返回 1 月 1 日
    return new Date(applicationYear, 0, 1);
  }

  /**
   * 获取用户所有时间线
   */
  async getTimelines(userId: string): Promise<TimelineResponseDto[]> {
    const timelines = await this.prisma.applicationTimeline.findMany({
      where: { userId },
      include: { tasks: true },
      orderBy: [{ priority: 'desc' }, { deadline: 'asc' }],
    });

    return timelines.map((t) => this.mapTimelineToResponse(t));
  }

  /**
   * 获取单个时间线详情（包含完整任务列表）
   */
  async getTimelineById(
    userId: string,
    id: string,
  ): Promise<TimelineResponseDto & { tasks: TaskResponseDto[] }> {
    const timeline = await this.prisma.applicationTimeline.findFirst({
      where: { id, userId },
      include: { tasks: { orderBy: { sortOrder: 'asc' } } },
    });

    if (!timeline) {
      throw new NotFoundException('时间线不存在');
    }

    return {
      ...this.mapTimelineToResponse(timeline),
      tasks: (timeline.tasks || []).map((t: any) => this.mapTaskToResponse(t)),
    };
  }

  /**
   * 更新时间线
   */
  async updateTimeline(
    userId: string,
    id: string,
    dto: UpdateTimelineDto,
  ): Promise<TimelineResponseDto> {
    const timeline = await this.prisma.applicationTimeline.findFirst({
      where: { id, userId },
    });

    if (!timeline) {
      throw new NotFoundException('时间线不存在');
    }

    const updated = await this.prisma.applicationTimeline.update({
      where: { id },
      data: {
        status: dto.status as ApplicationStatus,
        deadline: dto.deadline ? new Date(dto.deadline) : undefined,
        progress: dto.progress,
        priority: dto.priority,
        notes: dto.notes,
      },
      include: { tasks: true },
    });

    return this.mapTimelineToResponse(updated);
  }

  /**
   * 删除时间线
   */
  async deleteTimeline(userId: string, id: string): Promise<void> {
    const timeline = await this.prisma.applicationTimeline.findFirst({
      where: { id, userId },
    });

    if (!timeline) {
      throw new NotFoundException('时间线不存在');
    }

    await this.prisma.applicationTimeline.delete({
      where: { id },
    });
  }

  /**
   * 获取概览统计
   */
  async getOverview(userId: string): Promise<TimelineOverviewDto> {
    // 学校申请统计
    const timelines = await this.prisma.applicationTimeline.findMany({
      where: { userId },
      include: { tasks: true },
      orderBy: { deadline: 'asc' },
    });

    const now = new Date();
    const upcomingDeadlines = timelines
      .filter(
        (t) =>
          t.deadline &&
          t.deadline > now &&
          t.status !== ApplicationStatus.SUBMITTED,
      )
      .slice(0, 5);

    const allTasks = await this.prisma.applicationTask.findMany({
      where: {
        timeline: { userId },
        completed: false,
        dueDate: { lt: now },
      },
      include: { timeline: true },
      take: 10,
    });

    // 个人事件统计
    const personalEvents = await this.prisma.personalEvent.findMany({
      where: { userId },
      include: { tasks: true },
      orderBy: { deadline: 'asc' },
    });

    const upcomingPersonalEvents = personalEvents
      .filter(
        (e) =>
          (e.deadline && e.deadline > now) ||
          (e.eventDate && e.eventDate > now),
      )
      .filter((e) => e.status !== PersonalEventStatus.COMPLETED)
      .slice(0, 5)
      .map((e) => this.mapPersonalEventToResponse(e));

    return {
      // 学校
      totalSchools: timelines.length,
      submitted: timelines.filter(
        (t) => t.status === ApplicationStatus.SUBMITTED,
      ).length,
      inProgress: timelines.filter(
        (t) => t.status === ApplicationStatus.IN_PROGRESS,
      ).length,
      notStarted: timelines.filter(
        (t) => t.status === ApplicationStatus.NOT_STARTED,
      ).length,
      upcomingDeadlines: upcomingDeadlines.map((t) =>
        this.mapTimelineToResponse(t),
      ),
      overdueTasks: allTasks.map((task) => this.mapTaskToResponse(task)),
      // 个人事件
      totalPersonalEvents: personalEvents.length,
      personalInProgress: personalEvents.filter(
        (e) => e.status === PersonalEventStatus.IN_PROGRESS,
      ).length,
      personalCompleted: personalEvents.filter(
        (e) => e.status === PersonalEventStatus.COMPLETED,
      ).length,
      upcomingPersonalEvents,
    };
  }

  /**
   * 获取全局事件（面向普通用户的只读 API）
   */
  async getGlobalEvents(year?: number) {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const targetYear =
      year || (currentMonth >= 8 ? now.getFullYear() + 1 : now.getFullYear());

    return this.prisma.globalEvent.findMany({
      where: {
        isActive: true,
        year: targetYear,
      },
      orderBy: { eventDate: 'asc' },
    });
  }

  // ============ Task Methods ============

  /**
   * 创建任务
   */
  async createTask(
    userId: string,
    dto: CreateTaskDto,
  ): Promise<TaskResponseDto> {
    const timeline = await this.prisma.applicationTimeline.findFirst({
      where: { id: dto.timelineId, userId },
    });

    if (!timeline) {
      throw new NotFoundException('时间线不存在');
    }

    // 获取最大 sortOrder
    const maxOrder = await this.prisma.applicationTask.findFirst({
      where: { timelineId: dto.timelineId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });

    const task = await this.prisma.applicationTask.create({
      data: {
        timelineId: dto.timelineId,
        title: dto.title,
        type: (dto.type as TaskType) || TaskType.OTHER,
        description: dto.description,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        essayPrompt: dto.essayPrompt,
        wordLimit: dto.wordLimit,
        sortOrder: (maxOrder?.sortOrder || 0) + 1,
      },
    });

    // 更新时间线进度
    await this.updateTimelineProgress(dto.timelineId);

    return this.mapTaskToResponse(task);
  }

  /**
   * 更新任务
   */
  async updateTask(
    userId: string,
    taskId: string,
    dto: UpdateTaskDto,
  ): Promise<TaskResponseDto> {
    const task = await this.prisma.applicationTask.findFirst({
      where: { id: taskId },
      include: { timeline: true },
    });

    if (!task || task.timeline.userId !== userId) {
      throw new NotFoundException('任务不存在');
    }

    const updated = await this.prisma.applicationTask.update({
      where: { id: taskId },
      data: {
        title: dto.title,
        type: dto.type as TaskType,
        description: dto.description,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        completed: dto.completed,
        completedAt: dto.completed ? new Date() : null,
        essayId: dto.essayId,
        sortOrder: dto.sortOrder,
      },
    });

    // 更新时间线进度
    await this.updateTimelineProgress(task.timelineId);

    return this.mapTaskToResponse(updated);
  }

  /**
   * 删除任务
   */
  async deleteTask(userId: string, taskId: string): Promise<void> {
    const task = await this.prisma.applicationTask.findFirst({
      where: { id: taskId },
      include: { timeline: true },
    });

    if (!task || task.timeline.userId !== userId) {
      throw new NotFoundException('任务不存在');
    }

    await this.prisma.applicationTask.delete({
      where: { id: taskId },
    });

    await this.updateTimelineProgress(task.timelineId);
  }

  /**
   * 切换任务完成状态
   */
  async toggleTaskComplete(
    userId: string,
    taskId: string,
  ): Promise<TaskResponseDto> {
    const task = await this.prisma.applicationTask.findFirst({
      where: { id: taskId },
      include: { timeline: true },
    });

    if (!task || task.timeline.userId !== userId) {
      throw new NotFoundException('任务不存在');
    }

    const updated = await this.prisma.applicationTask.update({
      where: { id: taskId },
      data: {
        completed: !task.completed,
        completedAt: !task.completed ? new Date() : null,
      },
    });

    await this.updateTimelineProgress(task.timelineId);

    return this.mapTaskToResponse(updated);
  }

  // ============ Helper Methods ============

  private async updateTimelineProgress(timelineId: string): Promise<void> {
    const tasks = await this.prisma.applicationTask.findMany({
      where: { timelineId },
    });

    if (tasks.length === 0) return;

    const completedCount = tasks.filter((t) => t.completed).length;
    const progress = Math.round((completedCount / tasks.length) * 100);

    // 自动更新状态
    let status: ApplicationStatus = ApplicationStatus.NOT_STARTED;
    if (progress === 100) {
      status = ApplicationStatus.SUBMITTED;
    } else if (progress > 0) {
      status = ApplicationStatus.IN_PROGRESS;
    }

    await this.prisma.applicationTimeline.update({
      where: { id: timelineId },
      data: { progress, status },
    });
  }

  private mapTimelineToResponse(timeline: any): TimelineResponseDto {
    const tasks = timeline.tasks || [];
    return {
      id: timeline.id,
      schoolId: timeline.schoolId,
      schoolName: timeline.schoolName,
      round: timeline.round as ApplicationRound,
      deadline: timeline.deadline,
      status: timeline.status,
      progress: timeline.progress,
      priority: timeline.priority,
      notes: timeline.notes,
      tasksTotal: tasks.length,
      tasksCompleted: tasks.filter((t: any) => t.completed).length,
      createdAt: timeline.createdAt,
    };
  }

  private mapTaskToResponse(task: any): TaskResponseDto {
    return {
      id: task.id,
      timelineId: task.timelineId,
      title: task.title,
      type: task.type,
      description: task.description,
      dueDate: task.dueDate,
      completed: task.completed,
      completedAt: task.completedAt,
      essayPrompt: task.essayPrompt,
      wordLimit: task.wordLimit,
      sortOrder: task.sortOrder,
    };
  }

  // ============================================================
  // Personal Events (竞赛/考试/夏校/活动/材料)
  // ============================================================

  /** 默认子任务模板 */
  private readonly PERSONAL_TASK_TEMPLATES: Record<string, string[]> = {
    COMPETITION: [
      '了解竞赛规则和要求',
      '报名注册',
      '备赛准备',
      '参加竞赛',
      '查看结果',
    ],
    TEST: ['报名注册', '制定备考计划', '完成模考练习', '参加考试', '送分'],
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
  };

  /**
   * 创建个人事件（手动）
   */
  async createPersonalEvent(
    userId: string,
    dto: CreatePersonalEventDto,
  ): Promise<PersonalEventResponseDto> {
    const tasks =
      this.PERSONAL_TASK_TEMPLATES[dto.category] ||
      this.PERSONAL_TASK_TEMPLATES.OTHER;

    const event = await this.prisma.personalEvent.create({
      data: {
        userId,
        title: dto.title,
        category: dto.category,
        deadline: dto.deadline ? new Date(dto.deadline) : undefined,
        eventDate: dto.eventDate ? new Date(dto.eventDate) : undefined,
        priority: dto.priority || 0,
        description: dto.description,
        url: dto.url,
        notes: dto.notes,
        tasks: {
          create: tasks.map((title, index) => ({
            title,
            sortOrder: index,
          })),
        },
      },
      include: { tasks: true },
    });

    return this.mapPersonalEventToResponse(event);
  }

  /**
   * 从 GlobalEvent 订阅创建个人事件
   */
  async subscribeGlobalEvent(
    userId: string,
    dto: SubscribeGlobalEventDto,
  ): Promise<PersonalEventResponseDto> {
    const globalEvent = await this.prisma.globalEvent.findUnique({
      where: { id: dto.globalEventId },
    });

    if (!globalEvent) {
      throw new NotFoundException('全局事件不存在');
    }

    // 检查是否已订阅
    const existing = await this.prisma.personalEvent.findUnique({
      where: {
        userId_globalEventId: { userId, globalEventId: dto.globalEventId },
      },
    });

    if (existing) {
      throw new ConflictException('已订阅该事件');
    }

    // 根据 GlobalEvent category 映射到 PersonalEventCategory
    const categoryMap: Record<string, PersonalEventCategory> = {
      TEST: PersonalEventCategory.TEST,
      COMPETITION: PersonalEventCategory.COMPETITION,
      SUMMER_PROGRAM: PersonalEventCategory.SUMMER_PROGRAM,
      FINANCIAL_AID: PersonalEventCategory.MATERIAL,
      APPLICATION: PersonalEventCategory.OTHER,
      OTHER: PersonalEventCategory.OTHER,
    };
    const category =
      categoryMap[globalEvent.category] || PersonalEventCategory.OTHER;
    const tasks =
      this.PERSONAL_TASK_TEMPLATES[category] ||
      this.PERSONAL_TASK_TEMPLATES.OTHER;

    const event = await this.prisma.personalEvent.create({
      data: {
        userId,
        globalEventId: dto.globalEventId,
        title: globalEvent.titleZh || globalEvent.title,
        category,
        deadline: globalEvent.registrationDeadline || globalEvent.eventDate,
        eventDate: globalEvent.eventDate,
        description: globalEvent.descriptionZh || globalEvent.description,
        url: globalEvent.url,
        tasks: {
          create: tasks.map((title, index) => ({
            title,
            sortOrder: index,
          })),
        },
      },
      include: { tasks: true },
    });

    return this.mapPersonalEventToResponse(event);
  }

  /**
   * 获取用户所有个人事件
   */
  async getPersonalEvents(userId: string): Promise<PersonalEventResponseDto[]> {
    const events = await this.prisma.personalEvent.findMany({
      where: { userId },
      include: { tasks: true },
      orderBy: [{ priority: 'desc' }, { deadline: 'asc' }],
    });

    return events.map((e) => this.mapPersonalEventToResponse(e));
  }

  /**
   * 获取单个个人事件详情（含任务列表）
   */
  async getPersonalEventById(
    userId: string,
    id: string,
  ): Promise<PersonalEventResponseDto & { tasks: PersonalTaskResponseDto[] }> {
    const event = await this.prisma.personalEvent.findFirst({
      where: { id, userId },
      include: { tasks: { orderBy: { sortOrder: 'asc' } } },
    });

    if (!event) {
      throw new NotFoundException('个人事件不存在');
    }

    return {
      ...this.mapPersonalEventToResponse(event),
      tasks: (event.tasks || []).map((t) => this.mapPersonalTaskToResponse(t)),
    };
  }

  /**
   * 更新个人事件
   */
  async updatePersonalEvent(
    userId: string,
    id: string,
    dto: UpdatePersonalEventDto,
  ): Promise<PersonalEventResponseDto> {
    const event = await this.prisma.personalEvent.findFirst({
      where: { id, userId },
    });

    if (!event) {
      throw new NotFoundException('个人事件不存在');
    }

    const updated = await this.prisma.personalEvent.update({
      where: { id },
      data: {
        title: dto.title,
        category: dto.category,
        deadline: dto.deadline ? new Date(dto.deadline) : undefined,
        eventDate: dto.eventDate ? new Date(dto.eventDate) : undefined,
        status: dto.status,
        progress: dto.progress,
        priority: dto.priority,
        description: dto.description,
        url: dto.url,
        notes: dto.notes,
      },
      include: { tasks: true },
    });

    return this.mapPersonalEventToResponse(updated);
  }

  /**
   * 删除个人事件
   */
  async deletePersonalEvent(userId: string, id: string): Promise<void> {
    const event = await this.prisma.personalEvent.findFirst({
      where: { id, userId },
    });

    if (!event) {
      throw new NotFoundException('个人事件不存在');
    }

    await this.prisma.personalEvent.delete({ where: { id } });
  }

  // ============ Personal Task Methods ============

  /**
   * 创建个人任务
   */
  async createPersonalTask(
    userId: string,
    dto: CreatePersonalTaskDto,
  ): Promise<PersonalTaskResponseDto> {
    const event = await this.prisma.personalEvent.findFirst({
      where: { id: dto.eventId, userId },
    });

    if (!event) {
      throw new NotFoundException('个人事件不存在');
    }

    const maxOrder = await this.prisma.personalTask.findFirst({
      where: { eventId: dto.eventId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });

    const task = await this.prisma.personalTask.create({
      data: {
        eventId: dto.eventId,
        title: dto.title,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        sortOrder: (maxOrder?.sortOrder || 0) + 1,
      },
    });

    await this.updatePersonalEventProgress(dto.eventId);

    return this.mapPersonalTaskToResponse(task);
  }

  /**
   * 切换个人任务完成状态
   */
  async togglePersonalTaskComplete(
    userId: string,
    taskId: string,
  ): Promise<PersonalTaskResponseDto> {
    const task = await this.prisma.personalTask.findFirst({
      where: { id: taskId },
      include: { event: true },
    });

    if (!task || task.event.userId !== userId) {
      throw new NotFoundException('任务不存在');
    }

    const updated = await this.prisma.personalTask.update({
      where: { id: taskId },
      data: {
        completed: !task.completed,
        completedAt: !task.completed ? new Date() : null,
      },
    });

    await this.updatePersonalEventProgress(task.eventId);

    return this.mapPersonalTaskToResponse(updated);
  }

  /**
   * 删除个人任务
   */
  async deletePersonalTask(userId: string, taskId: string): Promise<void> {
    const task = await this.prisma.personalTask.findFirst({
      where: { id: taskId },
      include: { event: true },
    });

    if (!task || task.event.userId !== userId) {
      throw new NotFoundException('任务不存在');
    }

    await this.prisma.personalTask.delete({ where: { id: taskId } });
    await this.updatePersonalEventProgress(task.eventId);
  }

  // ============ Personal Event Helpers ============

  private async updatePersonalEventProgress(eventId: string): Promise<void> {
    const tasks = await this.prisma.personalTask.findMany({
      where: { eventId },
    });

    if (tasks.length === 0) return;

    const completedCount = tasks.filter((t) => t.completed).length;
    const progress = Math.round((completedCount / tasks.length) * 100);

    let status: PersonalEventStatus = PersonalEventStatus.NOT_STARTED;
    if (progress === 100) {
      status = PersonalEventStatus.COMPLETED;
    } else if (progress > 0) {
      status = PersonalEventStatus.IN_PROGRESS;
    }

    await this.prisma.personalEvent.update({
      where: { id: eventId },
      data: { progress, status },
    });
  }

  private mapPersonalEventToResponse(event: any): PersonalEventResponseDto {
    const tasks = event.tasks || [];
    return {
      id: event.id,
      category: event.category,
      title: event.title,
      globalEventId: event.globalEventId,
      deadline: event.deadline,
      eventDate: event.eventDate,
      status: event.status,
      progress: event.progress,
      priority: event.priority,
      description: event.description,
      url: event.url,
      notes: event.notes,
      tasksTotal: tasks.length,
      tasksCompleted: tasks.filter((t: any) => t.completed).length,
      createdAt: event.createdAt,
    };
  }

  private mapPersonalTaskToResponse(task: any): PersonalTaskResponseDto {
    return {
      id: task.id,
      eventId: task.eventId,
      title: task.title,
      dueDate: task.dueDate,
      completed: task.completed,
      completedAt: task.completedAt,
      sortOrder: task.sortOrder,
    };
  }
}
