import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ApplicationStatus, TaskType } from '@prisma/client';
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
} from './dto';

// 默认任务模板
const DEFAULT_TASKS = [
  { title: '完成 Common App 主文书', type: TaskType.ESSAY, essayPrompt: 'Common App Personal Statement', wordLimit: 650 },
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
  async createTimeline(userId: string, dto: CreateTimelineDto): Promise<TimelineResponseDto> {
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
   * 批量生成时间线
   */
  async generateTimelines(userId: string, dto: GenerateTimelineDto): Promise<TimelineResponseDto[]> {
    const results: TimelineResponseDto[] = [];

    for (const schoolId of dto.schoolIds) {
      try {
        const school = await this.prisma.school.findUnique({
          where: { id: schoolId },
        });

        if (!school) continue;

        // 检查是否已存在
        const existing = await this.prisma.applicationTimeline.findFirst({
          where: { userId, schoolId },
        });

        if (existing) continue;

        const timeline = await this.prisma.applicationTimeline.create({
          data: {
            userId,
            schoolId,
            schoolName: school.nameZh || school.name,
            round: 'RD', // 默认 RD
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
      } catch (error) {
        this.logger.warn(`Failed to create timeline for school ${schoolId}`, error);
      }
    }

    return results;
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
   * 获取单个时间线详情
   */
  async getTimelineById(userId: string, id: string): Promise<TimelineResponseDto> {
    const timeline = await this.prisma.applicationTimeline.findFirst({
      where: { id, userId },
      include: { tasks: { orderBy: { sortOrder: 'asc' } } },
    });

    if (!timeline) {
      throw new NotFoundException('时间线不存在');
    }

    return this.mapTimelineToResponse(timeline);
  }

  /**
   * 更新时间线
   */
  async updateTimeline(userId: string, id: string, dto: UpdateTimelineDto): Promise<TimelineResponseDto> {
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
    const timelines = await this.prisma.applicationTimeline.findMany({
      where: { userId },
      include: { tasks: true },
      orderBy: { deadline: 'asc' },
    });

    const now = new Date();
    const upcomingDeadlines = timelines
      .filter((t) => t.deadline && t.deadline > now && t.status !== ApplicationStatus.SUBMITTED)
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
      submitted: timelines.filter((t) => t.status === ApplicationStatus.SUBMITTED).length,
      inProgress: timelines.filter((t) => t.status === ApplicationStatus.IN_PROGRESS).length,
      notStarted: timelines.filter((t) => t.status === ApplicationStatus.NOT_STARTED).length,
      upcomingDeadlines: upcomingDeadlines.map((t) => this.mapTimelineToResponse(t)),
      overdueTasks: allTasks.map((task) => this.mapTaskToResponse(task)),
    };
  }

  // ============ Task Methods ============

  /**
   * 创建任务
   */
  async createTask(userId: string, dto: CreateTaskDto): Promise<TaskResponseDto> {
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
  async updateTask(userId: string, taskId: string, dto: UpdateTaskDto): Promise<TaskResponseDto> {
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
  async toggleTaskComplete(userId: string, taskId: string): Promise<TaskResponseDto> {
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
}



