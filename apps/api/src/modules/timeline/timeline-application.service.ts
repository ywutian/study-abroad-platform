import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ERR } from '../../common/constants/error-messages';
import { ApplicationStatus } from '@prisma/client';
import { TaskType } from '../../common/types/enums';
import { getSchoolDisplayName } from '../../common/utils/locale.util';
import {
  CreateTimelineDto,
  UpdateTimelineDto,
  TimelineResponseDto,
  CreateTaskDto,
  UpdateTaskDto,
  TaskResponseDto,
  GenerateTimelineDto,
  ApplicationRound,
} from './dto';

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
export class TimelineApplicationService {
  private readonly logger = new Logger(TimelineApplicationService.name);

  constructor(private prisma: PrismaService) {}

  async createTimeline(
    userId: string,
    dto: CreateTimelineDto,
    locale = 'zh',
  ): Promise<TimelineResponseDto> {
    const school = await this.prisma.school.findUnique({
      where: { id: dto.schoolId },
    });

    if (!school) {
      throw new NotFoundException(ERR.NOT_FOUND.school());
    }

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
      throw new ConflictException(ERR.CONFLICT.duplicateApplication());
    }

    const timeline = await this.prisma.applicationTimeline.create({
      data: {
        userId,
        schoolId: dto.schoolId,
        schoolName: getSchoolDisplayName(school, locale),
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
      include: { tasks: true },
    });

    return this.mapTimelineToResponse(timeline);
  }

  async generateTimelines(
    userId: string,
    dto: GenerateTimelineDto,
    locale = 'zh',
  ): Promise<{
    created: TimelineResponseDto[];
    failed: Array<{ schoolId: string; reason: string }>;
  }> {
    const created: TimelineResponseDto[] = [];
    const failed: Array<{ schoolId: string; reason: string }> = [];
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

        if (!school) {
          failed.push({ schoolId, reason: 'SCHOOL_NOT_FOUND' });
          continue;
        }

        const existingTimelines =
          await this.prisma.applicationTimeline.findMany({
            where: { userId, schoolId },
            select: { round: true },
          });
        const existingRounds = new Set(existingTimelines.map((t) => t.round));

        if (school.deadlines && school.deadlines.length > 0) {
          for (const dl of school.deadlines) {
            if (existingRounds.has(dl.round)) continue;

            const tasks = this.buildSmartTasks(
              dl.round,
              dl.essayPrompts,
              dl.essayCount,
              {
                interviewRequired: dl.interviewRequired ?? false,
                financialAidDeadline: dl.financialAidDeadline,
              },
            );
            const timeline = await this.prisma.applicationTimeline.create({
              data: {
                userId,
                schoolId,
                schoolName: getSchoolDisplayName(school, locale),
                round: dl.round,
                deadline: dl.applicationDeadline,
                tasks: { create: tasks },
              },
              include: { tasks: true },
            });
            created.push(this.mapTimelineToResponse(timeline));
            existingRounds.add(dl.round);
          }
        }

        if (created.filter((r) => r.schoolId === schoolId).length === 0) {
          const metadata = school.metadata as Record<string, any> | null;
          const deadlines = metadata?.deadlines as
            | Record<string, string>
            | undefined;

          if (deadlines && Object.keys(deadlines).length > 0) {
            for (const [roundKey, dateStr] of Object.entries(deadlines)) {
              const round = roundKey.toUpperCase();
              if (existingRounds.has(round)) continue;

              const parsedDate =
                this.parseMetadataDate(dateStr, applicationYear) ??
                new Date(applicationYear, 0, 15); // Jan 15 typical RD fallback
              const verifiedPrompts = await this.prisma.essayPrompt.findMany({
                where: { schoolId, isActive: true, status: 'VERIFIED' },
                orderBy: { sortOrder: 'asc' },
                select: { prompt: true, wordLimit: true },
              });
              const tasks = this.buildSmartTasks(
                round,
                verifiedPrompts.length > 0 ? verifiedPrompts : null,
                null,
              );
              const timeline = await this.prisma.applicationTimeline.create({
                data: {
                  userId,
                  schoolId,
                  schoolName: getSchoolDisplayName(school, locale),
                  round,
                  deadline: parsedDate,
                  tasks: { create: tasks },
                },
                include: { tasks: true },
              });
              created.push(this.mapTimelineToResponse(timeline));
              existingRounds.add(round);
            }
          }
        }

        if (
          created.filter((r) => r.schoolId === schoolId).length === 0 &&
          !existingRounds.has('RD')
        ) {
          const defaultDeadline = new Date(applicationYear, 0, 15); // Jan 15 typical RD
          const timeline = await this.prisma.applicationTimeline.create({
            data: {
              userId,
              schoolId,
              schoolName: getSchoolDisplayName(school, locale),
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
          created.push(this.mapTimelineToResponse(timeline));
        }
      } catch (error) {
        this.logger.warn(
          `Failed to create timeline for school ${schoolId}`,
          error,
        );
        failed.push({ schoolId, reason: 'INTERNAL_ERROR' });
      }
    }

    return { created, failed };
  }

  private buildSmartTasks(
    round: string,
    essayPrompts: any,
    essayCount: number | null,
    options?: {
      interviewRequired?: boolean;
      financialAidDeadline?: Date | null;
    },
  ) {
    const tasks: Array<{
      title: string;
      type: TaskType;
      essayPrompt?: string;
      wordLimit?: number;
      sortOrder: number;
    }> = [];

    let sortOrder = 0;

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

    tasks.push({
      title: '完成 Common App 主文书',
      type: TaskType.ESSAY,
      essayPrompt: 'Common App Personal Statement',
      wordLimit: 650,
      sortOrder: sortOrder++,
    });

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
      const count = essayCount || 1;
      for (let i = 0; i < count; i++) {
        tasks.push({
          title: `完成学校补充文书 ${count > 1 ? `#${i + 1}` : ''}`.trim(),
          type: TaskType.ESSAY,
          sortOrder: sortOrder++,
        });
      }
    }

    if (options?.interviewRequired) {
      tasks.push({
        title: '准备并完成面试',
        type: TaskType.INTERVIEW,
        sortOrder: sortOrder++,
      });
    }

    if (options?.financialAidDeadline) {
      tasks.push({
        title: '提交助学金申请 (CSS Profile/ISFAA)',
        type: TaskType.DOCUMENT,
        sortOrder: sortOrder++,
      });
    }

    tasks.push({
      title: '支付申请费',
      type: TaskType.OTHER,
      sortOrder: sortOrder++,
    });

    return tasks;
  }

  parseMetadataDate(dateStr: string, applicationYear: number): Date | null {
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

    const trimmed = dateStr.trim();

    const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (isoMatch) {
      const d = new Date(+isoMatch[1], +isoMatch[2] - 1, +isoMatch[3]);
      return isNaN(d.getTime()) ? null : d;
    }

    const fullMatch = trimmed.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
    if (fullMatch) {
      const monthNum = months[fullMatch[1].toLowerCase()];
      if (monthNum !== undefined) {
        return new Date(+fullMatch[3], monthNum, +fullMatch[2]);
      }
    }

    const monthDayMatch = trimmed.match(/^([A-Za-z]+)\s+(\d{1,2})$/);
    if (monthDayMatch) {
      const monthNum = months[monthDayMatch[1].toLowerCase()];
      if (monthNum !== undefined) {
        const dateYear = monthNum >= 8 ? applicationYear - 1 : applicationYear;
        return new Date(dateYear, monthNum, +monthDayMatch[2]);
      }
    }

    const numericMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})$/);
    if (numericMatch) {
      const monthNum = +numericMatch[1] - 1;
      if (monthNum >= 0 && monthNum <= 11) {
        const dateYear = monthNum >= 7 ? applicationYear - 1 : applicationYear;
        return new Date(dateYear, monthNum, +numericMatch[2]);
      }
    }

    return null;
  }

  async getTimelines(userId: string): Promise<TimelineResponseDto[]> {
    const timelines = await this.prisma.applicationTimeline.findMany({
      where: { userId },
      include: { tasks: true },
      orderBy: [{ priority: 'desc' }, { deadline: 'asc' }],
    });

    return timelines.map((t) => this.mapTimelineToResponse(t));
  }

  async getTimelineById(
    userId: string,
    id: string,
  ): Promise<TimelineResponseDto & { tasks: TaskResponseDto[] }> {
    const timeline = await this.prisma.applicationTimeline.findFirst({
      where: { id, userId },
      include: { tasks: { orderBy: { sortOrder: 'asc' } } },
    });

    if (!timeline) {
      throw new NotFoundException(ERR.NOT_FOUND.timeline());
    }

    return {
      ...this.mapTimelineToResponse(timeline),
      tasks: (timeline.tasks || []).map((t: any) => this.mapTaskToResponse(t)),
    };
  }

  async updateTimeline(
    userId: string,
    id: string,
    dto: UpdateTimelineDto,
  ): Promise<TimelineResponseDto> {
    const timeline = await this.prisma.applicationTimeline.findFirst({
      where: { id, userId },
    });

    if (!timeline) {
      throw new NotFoundException(ERR.NOT_FOUND.timeline());
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

  async deleteTimeline(userId: string, id: string): Promise<void> {
    const timeline = await this.prisma.applicationTimeline.findFirst({
      where: { id, userId },
    });

    if (!timeline) {
      throw new NotFoundException(ERR.NOT_FOUND.timeline());
    }

    await this.prisma.applicationTimeline.delete({ where: { id } });
  }

  async getOverview(userId: string) {
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

    return {
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
    };
  }

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

  async createTask(
    userId: string,
    dto: CreateTaskDto,
  ): Promise<TaskResponseDto> {
    const timeline = await this.prisma.applicationTimeline.findFirst({
      where: { id: dto.timelineId, userId },
    });

    if (!timeline) {
      throw new NotFoundException(ERR.NOT_FOUND.timeline());
    }

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

    await this.updateTimelineProgress(dto.timelineId);

    return this.mapTaskToResponse(task);
  }

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
      throw new NotFoundException(ERR.NOT_FOUND.task());
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

    await this.updateTimelineProgress(task.timelineId);

    return this.mapTaskToResponse(updated);
  }

  async deleteTask(userId: string, taskId: string): Promise<void> {
    const task = await this.prisma.applicationTask.findFirst({
      where: { id: taskId },
      include: { timeline: true },
    });

    if (!task || task.timeline.userId !== userId) {
      throw new NotFoundException(ERR.NOT_FOUND.task());
    }

    await this.prisma.applicationTask.delete({ where: { id: taskId } });
    await this.updateTimelineProgress(task.timelineId);
  }

  async toggleTaskComplete(
    userId: string,
    taskId: string,
  ): Promise<TaskResponseDto> {
    const task = await this.prisma.applicationTask.findFirst({
      where: { id: taskId },
      include: { timeline: true },
    });

    if (!task || task.timeline.userId !== userId) {
      throw new NotFoundException(ERR.NOT_FOUND.task());
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

  // ============ Helpers ============

  private async updateTimelineProgress(timelineId: string): Promise<void> {
    const tasks = await this.prisma.applicationTask.findMany({
      where: { timelineId },
    });

    if (tasks.length === 0) return;

    const completedCount = tasks.filter((t) => t.completed).length;
    const progress = Math.round((completedCount / tasks.length) * 100);

    const current = await this.prisma.applicationTimeline.findUnique({
      where: { id: timelineId },
      select: { status: true },
    });

    const manualStatuses: Set<string> = new Set([
      ApplicationStatus.SUBMITTED,
      ApplicationStatus.ACCEPTED,
      ApplicationStatus.REJECTED,
      ApplicationStatus.WAITLISTED,
      ApplicationStatus.WITHDRAWN,
    ]);

    const data: { progress: number; status?: ApplicationStatus } = { progress };

    if (!current || !manualStatuses.has(current.status)) {
      data.status =
        progress > 0
          ? ApplicationStatus.IN_PROGRESS
          : ApplicationStatus.NOT_STARTED;
    }

    await this.prisma.applicationTimeline.update({
      where: { id: timelineId },
      data,
    });
  }

  mapTimelineToResponse(timeline: any): TimelineResponseDto {
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

  mapTaskToResponse(task: any): TaskResponseDto {
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
}
