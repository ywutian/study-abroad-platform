import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ERR } from '../../common/constants/error-messages';
import { ApplicationStatus, Prisma, type GlobalEvent } from '@prisma/client';
import { TaskType } from '../../common/types/enums';
import { getSchoolDisplayName } from '../../common/utils/locale.util';
import { resolveApplicationYear } from '@study-abroad/shared';
import {
  cycleRoundKey,
  inferApplicationYear,
  isApplicationTimelineArchived,
  isBeforeUtcDay,
  isTerminalApplicationStatus,
  withEffectiveRecurringGlobalEvent,
} from './timeline-date.util';
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

    const applicationYear =
      dto.applicationYear ?? inferApplicationYear(dto.deadline);
    const existing = await this.prisma.applicationTimeline.findUnique({
      where: {
        userId_schoolId_round_applicationYear: {
          userId,
          schoolId: dto.schoolId,
          round: dto.round,
          applicationYear,
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
        applicationYear,
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
    // Fall-entry year of the cycle most likely active for new applications. The
    // seed stores deadlines by fall-entry year (e.g. CYCLE_YEAR 2027 = future
    // Nov-2026+ dates), so in the off-season (May–Jul) `applicationYear` lands on
    // the just-finished cycle whose deadlines are all past. We therefore fetch
    // BOTH this and next year's deadlines below and let selectEffectiveDeadlines
    // pick the soonest *future* one per round — so generation produces dated
    // timelines year-round instead of empty results in the off-season.
    const applicationYear = resolveApplicationYear(now);

    // Batch every read up front — the per-school N+1 (school + existing
    // timelines + essay prompts, ×N schools, serially) was the fan-out that
    // forced @ThrottleAI on this endpoint. Now it's a fixed 2–3 queries.
    const schools = await this.prisma.school.findMany({
      where: { id: { in: dto.schoolIds } },
      include: {
        deadlines: {
          where: {
            year: { in: [applicationYear, applicationYear + 1] },
            source: { not: 'MANUAL' },
            notes: { not: null },
          },
          orderBy: [{ year: 'desc' }, { applicationDeadline: 'asc' }],
        },
      },
    });
    const schoolById = new Map(schools.map((s) => [s.id, s]));
    type EffectiveDeadline = (typeof schools)[number]['deadlines'][number];

    const existingTimelines = await this.prisma.applicationTimeline.findMany({
      where: { userId, schoolId: { in: dto.schoolIds } },
      select: { schoolId: true, round: true, applicationYear: true },
    });
    const existingRoundsBySchool = new Map<string, Set<string>>();
    for (const t of existingTimelines) {
      const set = existingRoundsBySchool.get(t.schoolId) ?? new Set<string>();
      set.add(cycleRoundKey(t.applicationYear, t.round));
      existingRoundsBySchool.set(t.schoolId, set);
    }

    // First pass (in-memory): resolve each school's effective source-backed
    // deadlines. Only schools that yield ≥1 deadline need essay prompts — so a
    // school with no plannable deadlines never triggers a prompt query.
    const effectiveBySchool = new Map<string, EffectiveDeadline[]>();
    for (const school of schools) {
      const effective = this.selectEffectiveDeadlines(
        (school.deadlines ?? []).filter((deadline) =>
          this.isSourceBackedPlannableDeadline(deadline, applicationYear),
        ),
        now,
      );
      if (effective.length > 0) effectiveBySchool.set(school.id, effective);
    }

    const promptsBySchool = new Map<
      string,
      Array<{ prompt: string; wordLimit: number | null }>
    >();
    const schoolIdsNeedingPrompts = [...effectiveBySchool.keys()];
    if (schoolIdsNeedingPrompts.length > 0) {
      const prompts = await this.prisma.essayPrompt.findMany({
        where: {
          schoolId: { in: schoolIdsNeedingPrompts },
          isActive: true,
          status: 'VERIFIED',
          sources: { some: { sourceUrl: { not: null } } },
        },
        orderBy: { sortOrder: 'asc' },
        select: { schoolId: true, prompt: true, wordLimit: true },
      });
      for (const p of prompts) {
        const list = promptsBySchool.get(p.schoolId) ?? [];
        list.push({ prompt: p.prompt, wordLimit: p.wordLimit });
        promptsBySchool.set(p.schoolId, list);
      }
    }

    // Second pass: create timelines (per-round writes). Per-school try/catch
    // preserves partial success — one school's failure doesn't abort the batch.
    // Iterating dto.schoolIds keeps created/failed in the caller's order.
    for (const schoolId of dto.schoolIds) {
      try {
        const school = schoolById.get(schoolId);
        if (!school) {
          failed.push({ schoolId, reason: 'SCHOOL_NOT_FOUND' });
          continue;
        }

        const effectiveDeadlines = effectiveBySchool.get(schoolId);
        if (!effectiveDeadlines) {
          failed.push({ schoolId, reason: 'DEADLINE_SOURCE_REQUIRED' });
          continue;
        }

        const existingRounds =
          existingRoundsBySchool.get(schoolId) ?? new Set<string>();
        const sourceBackedEssayPrompts = promptsBySchool.get(schoolId) ?? [];

        for (const dl of effectiveDeadlines) {
          const cycleRound = cycleRoundKey(dl.year, dl.round);
          if (existingRounds.has(cycleRound)) continue;

          const tasks = this.buildSmartTasks(
            dl.round,
            sourceBackedEssayPrompts,
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
              applicationYear: dl.year,
              deadline: dl.applicationDeadline,
              tasks: { create: tasks },
            },
            include: { tasks: true },
          });
          created.push(this.mapTimelineToResponse(timeline));
          existingRounds.add(cycleRound);
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

  private isSourceBackedPlannableDeadline<
    T extends { year?: number; source?: string | null; notes?: string | null },
  >(deadline: T, applicationYear: number): boolean {
    const source = deadline.source?.trim().toUpperCase();
    const notes = deadline.notes?.trim() ?? '';

    // Accept the current OR next fall-entry cycle (see the applicationYear note);
    // selectEffectiveDeadlines then keeps the soonest future deadline per round.
    return (
      (deadline.year === applicationYear ||
        deadline.year === applicationYear + 1) &&
      Boolean(source) &&
      source !== 'MANUAL' &&
      /https?:\/\//i.test(notes)
    );
  }

  private selectEffectiveDeadlines<
    T extends { round: string; applicationDeadline: Date },
  >(deadlines: T[], now: Date): T[] {
    const byRound = new Map<string, T[]>();

    for (const deadline of deadlines) {
      const group = byRound.get(deadline.round) ?? [];
      group.push(deadline);
      byRound.set(deadline.round, group);
    }

    const selected: T[] = [];
    for (const items of byRound.values()) {
      const next = items
        .filter((item) => !isBeforeUtcDay(item.applicationDeadline, now))
        .sort(
          (a, b) =>
            a.applicationDeadline.getTime() - b.applicationDeadline.getTime(),
        )[0];
      if (next) selected.push(next);
    }

    return selected.sort(
      (a, b) =>
        a.applicationDeadline.getTime() - b.applicationDeadline.getTime(),
    );
  }

  private buildSmartTasks(
    round: string,
    essayPrompts: any,
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
    this.assertTimelineMutable(timeline);

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
    this.assertTimelineMutable(timeline);

    await this.prisma.applicationTimeline.delete({ where: { id } });
  }

  async getOverview(userId: string) {
    const now = new Date();
    const applicationYear = resolveApplicationYear(now);
    const timelines = await this.prisma.applicationTimeline.findMany({
      where: { userId, applicationYear: { gte: applicationYear } },
      include: { tasks: true },
      orderBy: { deadline: 'asc' },
    });

    const upcomingDeadlines = timelines
      .filter(
        (timeline) =>
          timeline.deadline &&
          timeline.deadline > now &&
          !isTerminalApplicationStatus(timeline.status),
      )
      .slice(0, 5);

    const allTasks = await this.prisma.applicationTask.findMany({
      where: {
        timeline: { userId, applicationYear: { gte: applicationYear } },
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

  async getGlobalEvents(year?: number): Promise<GlobalEvent[]> {
    const now = new Date();

    if (typeof year === 'number') {
      // governance: system-scope — GlobalEvent is platform-wide calendar data with no User/Profile relation
      return this.prisma.globalEvent.findMany({
        where: {
          isActive: true,
          year,
        },
        orderBy: { eventDate: 'asc' },
      });
    }

    // governance: system-scope — GlobalEvent is platform-wide calendar data with no User/Profile relation
    const events = await this.prisma.globalEvent.findMany({
      where: { isActive: true },
      orderBy: { eventDate: 'asc' },
    });

    return events
      .map((event) => withEffectiveRecurringGlobalEvent(event, now))
      .filter((event) => !isBeforeUtcDay(event.eventDate, now))
      .sort((a, b) => a.eventDate.getTime() - b.eventDate.getTime());
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
    this.assertTimelineMutable(timeline);

    const task = await this.prisma.$transaction(async (tx) => {
      const maxOrder = await tx.applicationTask.findFirst({
        where: { timelineId: dto.timelineId },
        orderBy: { sortOrder: 'desc' },
        select: { sortOrder: true },
      });
      const created = await tx.applicationTask.create({
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
      await this.updateTimelineProgress(dto.timelineId, tx);
      return created;
    });

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
    this.assertTimelineMutable(task.timeline);

    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.applicationTask.update({
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
      await this.updateTimelineProgress(task.timelineId, tx);
      return u;
    });

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
    this.assertTimelineMutable(task.timeline);

    await this.prisma.$transaction(async (tx) => {
      await tx.applicationTask.delete({ where: { id: taskId } });
      await this.updateTimelineProgress(task.timelineId, tx);
    });
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
    this.assertTimelineMutable(task.timeline);

    const updated = await this.prisma.$transaction(async (tx) => {
      // Conditional flip: only flips if `completed` is still what we read, so two
      // concurrent toggles (the web+mobile dual-consumer) can't both apply a lost
      // update — the second matches 0 rows and the caller sees the real state.
      await tx.applicationTask.updateMany({
        where: { id: taskId, completed: task.completed },
        data: {
          completed: !task.completed,
          completedAt: !task.completed ? new Date() : null,
        },
      });
      const fresh = await tx.applicationTask.findUniqueOrThrow({
        where: { id: taskId },
      });
      await this.updateTimelineProgress(task.timelineId, tx);
      return fresh;
    });

    return this.mapTaskToResponse(updated);
  }

  // ============ Helpers ============

  private assertTimelineMutable(timeline: {
    status: string;
    deadline?: Date | null;
  }): void {
    if (isApplicationTimelineArchived(timeline)) {
      throw new ConflictException(ERR.CONFLICT.archivedTimelineReadOnly());
    }
  }

  // Accepts the active transaction client so the recompute reads the SAME
  // snapshot as the mutation that triggered it (no lost-update / stale-progress
  // race between concurrent task changes). Uses aggregate counts instead of
  // materializing every task row.
  private async updateTimelineProgress(
    timelineId: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    const total = await client.applicationTask.count({ where: { timelineId } });

    if (total === 0) return;

    const completedCount = await client.applicationTask.count({
      where: { timelineId, completed: true },
    });
    const progress = Math.round((completedCount / total) * 100);

    const current = await client.applicationTimeline.findUnique({
      where: { id: timelineId },
      select: { status: true },
    });

    const data: { progress: number; status?: ApplicationStatus } = { progress };

    if (!current || !isTerminalApplicationStatus(current.status)) {
      data.status =
        progress > 0
          ? ApplicationStatus.IN_PROGRESS
          : ApplicationStatus.NOT_STARTED;
    }

    await client.applicationTimeline.update({
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
      applicationYear: timeline.applicationYear,
      deadline: timeline.deadline ?? undefined,
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
    const sourceState = this.resolveTaskSourceState(task);

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
      ...sourceState,
      sortOrder: task.sortOrder,
    };
  }

  private resolveTaskSourceState(
    task: any,
  ): Pick<TaskResponseDto, 'sourceStatus' | 'sourcePolicy'> {
    if (task.type !== TaskType.ESSAY) {
      return { sourceStatus: 'first_party' };
    }

    const text = `${task.title ?? ''} ${task.essayPrompt ?? ''}`.toLowerCase();
    if (text.includes('common app') || text.includes('personal statement')) {
      return {
        sourceStatus: 'generic',
        sourcePolicy:
          'Generic Common App writing task; not a school-specific sourced prompt.',
      };
    }

    return {
      sourceStatus: 'source_review_required',
      sourcePolicy:
        'School-specific essay task must link to a source-backed verified EssayPrompt before it is treated as authoritative.',
    };
  }
}
