import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ERR } from '../../common/constants/error-messages';
import {
  PersonalEventStatus,
  PersonalEventCategory,
  Prisma,
} from '@prisma/client';
import {
  CreatePersonalEventDto,
  UpdatePersonalEventDto,
  SubscribeGlobalEventDto,
  PersonalEventResponseDto,
  CreatePersonalTaskDto,
  PersonalTaskResponseDto,
} from './dto';
import {
  isPersonalEventArchived,
  withEffectiveRecurringGlobalEvent,
} from './timeline-date.util';

type PersonalEventWithTasks = Pick<
  Prisma.PersonalEventGetPayload<object>,
  | 'id'
  | 'category'
  | 'title'
  | 'globalEventId'
  | 'deadline'
  | 'eventDate'
  | 'status'
  | 'progress'
  | 'priority'
  | 'description'
  | 'url'
  | 'notes'
  | 'createdAt'
> & { tasks?: Array<{ completed: boolean }> };
type PersonalTaskRecord = Pick<
  Prisma.PersonalTaskGetPayload<object>,
  | 'id'
  | 'eventId'
  | 'title'
  | 'dueDate'
  | 'completed'
  | 'completedAt'
  | 'sortOrder'
>;

@Injectable()
export class TimelinePersonalEventService {
  private readonly logger = new Logger(TimelinePersonalEventService.name);

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

  constructor(private prisma: PrismaService) {}

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

  async subscribeGlobalEvent(
    userId: string,
    dto: SubscribeGlobalEventDto,
  ): Promise<PersonalEventResponseDto> {
    const globalEvent = await this.prisma.globalEvent.findUnique({
      where: { id: dto.globalEventId },
    });

    if (!globalEvent) {
      throw new NotFoundException(ERR.NOT_FOUND.globalEvent());
    }

    const existing = await this.prisma.personalEvent.findUnique({
      where: {
        userId_globalEventId: { userId, globalEventId: dto.globalEventId },
      },
    });

    if (existing) {
      throw new ConflictException(ERR.CONFLICT.alreadySubscribed());
    }

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
    const effectiveGlobalEvent = withEffectiveRecurringGlobalEvent(globalEvent);

    const event = await this.prisma.personalEvent.create({
      data: {
        userId,
        globalEventId: dto.globalEventId,
        title: effectiveGlobalEvent.titleZh || effectiveGlobalEvent.title,
        category,
        deadline:
          effectiveGlobalEvent.registrationDeadline ||
          effectiveGlobalEvent.eventDate,
        eventDate: effectiveGlobalEvent.eventDate,
        description:
          effectiveGlobalEvent.descriptionZh ||
          effectiveGlobalEvent.description,
        url: effectiveGlobalEvent.url,
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

  async getPersonalEvents(userId: string): Promise<PersonalEventResponseDto[]> {
    const events = await this.prisma.personalEvent.findMany({
      where: { userId },
      include: { tasks: true },
      orderBy: [{ priority: 'desc' }, { deadline: 'asc' }],
    });

    return events.map((e) => this.mapPersonalEventToResponse(e));
  }

  async getPersonalEventById(
    userId: string,
    id: string,
  ): Promise<PersonalEventResponseDto & { tasks: PersonalTaskResponseDto[] }> {
    const event = await this.prisma.personalEvent.findFirst({
      where: { id, userId },
      include: { tasks: { orderBy: { sortOrder: 'asc' } } },
    });

    if (!event) {
      throw new NotFoundException(ERR.NOT_FOUND.personalEvent());
    }

    return {
      ...this.mapPersonalEventToResponse(event),
      tasks: (event.tasks || []).map((t) => this.mapPersonalTaskToResponse(t)),
    };
  }

  async updatePersonalEvent(
    userId: string,
    id: string,
    dto: UpdatePersonalEventDto,
  ): Promise<PersonalEventResponseDto> {
    const event = await this.prisma.personalEvent.findFirst({
      where: { id, userId },
    });

    if (!event) {
      throw new NotFoundException(ERR.NOT_FOUND.personalEvent());
    }
    this.assertPersonalEventMutable(event);

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

  async deletePersonalEvent(userId: string, id: string): Promise<void> {
    const event = await this.prisma.personalEvent.findFirst({
      where: { id, userId },
    });

    if (!event) {
      throw new NotFoundException(ERR.NOT_FOUND.personalEvent());
    }
    this.assertPersonalEventMutable(event);

    await this.prisma.personalEvent.delete({ where: { id } });
  }

  // ============ Personal Task Methods ============

  async createPersonalTask(
    userId: string,
    dto: CreatePersonalTaskDto,
  ): Promise<PersonalTaskResponseDto> {
    const event = await this.prisma.personalEvent.findFirst({
      where: { id: dto.eventId, userId },
    });

    if (!event) {
      throw new NotFoundException(ERR.NOT_FOUND.personalEvent());
    }
    this.assertPersonalEventMutable(event);

    const task = await this.prisma.$transaction(async (tx) => {
      const maxOrder = await tx.personalTask.findFirst({
        where: { eventId: dto.eventId },
        orderBy: { sortOrder: 'desc' },
        select: { sortOrder: true },
      });
      const created = await tx.personalTask.create({
        data: {
          eventId: dto.eventId,
          title: dto.title,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
          sortOrder: (maxOrder?.sortOrder || 0) + 1,
        },
      });
      await this.updatePersonalEventProgress(dto.eventId, tx);
      return created;
    });

    return this.mapPersonalTaskToResponse(task);
  }

  async togglePersonalTaskComplete(
    userId: string,
    taskId: string,
  ): Promise<PersonalTaskResponseDto> {
    const task = await this.prisma.personalTask.findFirst({
      where: { id: taskId },
      include: { event: true },
    });

    if (!task || task.event.userId !== userId) {
      throw new NotFoundException(ERR.NOT_FOUND.task());
    }
    this.assertPersonalEventMutable(task.event);

    const updated = await this.prisma.$transaction(async (tx) => {
      // Conditional flip guards against concurrent toggles both applying.
      await tx.personalTask.updateMany({
        where: { id: taskId, completed: task.completed },
        data: {
          completed: !task.completed,
          completedAt: !task.completed ? new Date() : null,
        },
      });
      const fresh = await tx.personalTask.findUniqueOrThrow({
        where: { id: taskId },
      });
      await this.updatePersonalEventProgress(task.eventId, tx);
      return fresh;
    });

    return this.mapPersonalTaskToResponse(updated);
  }

  async deletePersonalTask(userId: string, taskId: string): Promise<void> {
    const task = await this.prisma.personalTask.findFirst({
      where: { id: taskId },
      include: { event: true },
    });

    if (!task || task.event.userId !== userId) {
      throw new NotFoundException(ERR.NOT_FOUND.task());
    }
    this.assertPersonalEventMutable(task.event);

    await this.prisma.$transaction(async (tx) => {
      await tx.personalTask.delete({ where: { id: taskId } });
      await this.updatePersonalEventProgress(task.eventId, tx);
    });
  }

  // ============ Helpers ============

  private assertPersonalEventMutable(event: {
    status: string;
    deadline?: Date | null;
    eventDate?: Date | null;
  }): void {
    if (isPersonalEventArchived(event)) {
      throw new ConflictException(ERR.CONFLICT.archivedTimelineReadOnly());
    }
  }

  // Accepts the active transaction client so the recompute reads the same
  // snapshot as the mutation (no lost-update race). The recomputed progress
  // drives the terminal COMPLETED status the reminder scheduler filters on, so a
  // stale recompute here would wrongly suppress/fire reminders — hence the txn.
  private async updatePersonalEventProgress(
    eventId: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    const total = await client.personalTask.count({ where: { eventId } });

    if (total === 0) return;

    const completedCount = await client.personalTask.count({
      where: { eventId, completed: true },
    });
    const progress = Math.round((completedCount / total) * 100);

    let status: PersonalEventStatus = PersonalEventStatus.NOT_STARTED;
    if (progress === 100) {
      status = PersonalEventStatus.COMPLETED;
    } else if (progress > 0) {
      status = PersonalEventStatus.IN_PROGRESS;
    }

    await client.personalEvent.update({
      where: { id: eventId },
      data: { progress, status },
    });
  }

  mapPersonalEventToResponse(
    event: PersonalEventWithTasks,
  ): PersonalEventResponseDto {
    const tasks = event.tasks ?? [];
    return {
      id: event.id,
      category: event.category,
      title: event.title,
      globalEventId: event.globalEventId ?? undefined,
      deadline: event.deadline ?? undefined,
      eventDate: event.eventDate ?? undefined,
      status: event.status,
      progress: event.progress,
      priority: event.priority,
      description: event.description ?? undefined,
      url: event.url ?? undefined,
      notes: event.notes ?? undefined,
      tasksTotal: tasks.length,
      tasksCompleted: tasks.filter((task) => task.completed).length,
      createdAt: event.createdAt,
    };
  }

  mapPersonalTaskToResponse(task: PersonalTaskRecord): PersonalTaskResponseDto {
    return {
      id: task.id,
      eventId: task.eventId,
      title: task.title,
      dueDate: task.dueDate ?? undefined,
      completed: task.completed,
      completedAt: task.completedAt ?? undefined,
      sortOrder: task.sortOrder,
    };
  }
}
