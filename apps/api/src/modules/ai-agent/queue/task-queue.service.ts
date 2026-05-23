/**
 * 异步任务队列服务
 *
 * 基于 Redis 的轻量级任务队列：
 * 1. 延迟任务
 * 2. 重试机制
 * 3. 优先级调度
 * 4. 任务持久化
 */

import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { RedisService } from '../../../common/redis/redis.service';

// ==================== 类型定义 ====================

export enum TaskType {
  // 记忆任务
  MEMORY_DECAY = 'MEMORY_DECAY',
  MEMORY_COMPACTION = 'MEMORY_COMPACTION',
  MEMORY_EMBEDDING = 'MEMORY_EMBEDDING',

  // 统计任务
  USAGE_REPORT = 'USAGE_REPORT',
  SECURITY_REPORT = 'SECURITY_REPORT',

  // 清理任务
  CLEANUP_EXPIRED = 'CLEANUP_EXPIRED',
  CLEANUP_ORPHANED = 'CLEANUP_ORPHANED',

  // 通知任务
  SEND_ALERT = 'SEND_ALERT',
  SEND_NOTIFICATION = 'SEND_NOTIFICATION',
}

export enum TaskStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export interface Task<T = unknown> {
  id: string;
  type: TaskType;
  payload: T;
  priority: number; // 0-10, 越高越优先
  status: TaskStatus;
  attempts: number;
  maxAttempts: number;
  scheduledAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  result?: unknown;
  createdAt: Date;
}

export interface TaskResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

type TaskHandler<T = unknown, R = unknown> = (
  payload: T,
) => Promise<TaskResult<R>>;

// ==================== 服务实现 ====================

@Injectable()
export class TaskQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TaskQueueService.name);

  // 任务处理器注册表
  private handlers: Map<TaskType, TaskHandler> = new Map();

  // 运行状态
  private isRunning = false;
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private concurrency = 5;
  private activeWorkers = 0;

  // ── Polling cadence (Redis quota protection) ──
  // Base poll cadence — was 1s, which costs ~172k Redis ops/day even when
  // the queue is empty AND no module ever calls `add()`. That single value
  // was the dominant burn on the Upstash free-tier 500k/day quota.
  // 30s base is still snappy for the not-yet-wired async workloads this
  // service was scaffolded for.
  private static readonly BASE_POLL_MS = 30_000;
  // When several polls in a row find no work, back off geometrically up to
  // this ceiling. Resets to BASE_POLL_MS as soon as a task is picked up.
  private static readonly MAX_POLL_MS = 5 * 60_000; // 5 min
  private currentPollMs = TaskQueueService.BASE_POLL_MS;
  private emptyPollStreak = 0;

  // Redis 键
  private readonly QUEUE_KEY = 'agent:task:queue';
  private readonly PROCESSING_KEY = 'agent:task:processing';
  private readonly DELAYED_KEY = 'agent:task:delayed';

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  onModuleInit() {
    // Don't start the poll loop in onModuleInit anymore. There were ZERO
    // callers of `taskQueue.add()` across the codebase, yet a 1s polling
    // loop kept burning 172k Redis ops/day (the dominant contributor to
    // the Upstash 500k/day quota exhaustion that broke the admin panel).
    //
    // Now polling is lazy: `register()` starts it on first handler. Until
    // a module actually registers a task type, the queue is dormant and
    // costs zero Redis ops. If/when async workloads come online, calling
    // `register()` will start polling at the new 30s cadence with
    // exponential back-off when empty.
    this.logger.log(
      'Task queue ready (polling will start on first handler registration)',
    );
  }

  onModuleDestroy() {
    this.stop();
  }

  // ==================== 任务管理 ====================

  /**
   * 注册任务处理器
   *
   * Side effect: bootstraps the poll loop on first registration. Until at
   * least one module calls register(), the queue is dormant and costs 0
   * Redis ops. See onModuleInit comment for the quota incident.
   */
  register<T, R>(type: TaskType, handler: TaskHandler<T, R>): void {
    this.handlers.set(type, handler as TaskHandler);
    this.logger.log(`Registered handler for ${type}`);
    if (!this.isRunning && this.redis.connected) {
      this.start();
    }
  }

  /**
   * 添加任务
   */
  async add<T>(
    type: TaskType,
    payload: T,
    options?: {
      priority?: number;
      delay?: number; // 延迟毫秒
      maxAttempts?: number;
      userId?: string;
    },
  ): Promise<string> {
    const taskId = this.generateTaskId();
    const now = new Date();
    const scheduledAt = options?.delay
      ? new Date(now.getTime() + options.delay)
      : now;

    const task: Task<T> = {
      id: taskId,
      type,
      payload,
      priority: options?.priority ?? 5,
      status: TaskStatus.PENDING,
      attempts: 0,
      maxAttempts: options?.maxAttempts ?? 3,
      scheduledAt,
      createdAt: now,
    };

    // 持久化到数据库
    await this.prisma.$executeRaw`
      INSERT INTO "AgentTask" (
        id, "userId", type, status, priority, payload,
        "maxAttempts", "scheduledAt", "createdAt", "updatedAt"
      ) VALUES (
        ${taskId},
        ${options?.userId || null},
        ${type},
        ${TaskStatus.PENDING},
        ${task.priority},
        ${JSON.stringify(payload)}::jsonb,
        ${task.maxAttempts},
        ${scheduledAt},
        ${now},
        ${now}
      )
    `;

    // 添加到 Redis 队列
    const client = this.redis.getClient();
    if (client && this.redis.connected) {
      try {
        if (options?.delay) {
          // 延迟任务
          await client.zadd(
            this.DELAYED_KEY,
            scheduledAt.getTime(),
            JSON.stringify(task),
          );
        } else {
          // 立即任务（按优先级）
          await client.zadd(
            this.QUEUE_KEY,
            -task.priority, // 负数使高优先级排前面
            JSON.stringify(task),
          );
        }
      } catch (err) {
        this.logger.error(`Failed to add task to Redis: ${String(err)}`);
      }
    }

    this.logger.debug(`Task added: ${taskId} (${type})`);
    return taskId;
  }

  /**
   * 取消任务
   */
  async cancel(taskId: string): Promise<boolean> {
    // 更新数据库状态
    const result = await this.prisma.$executeRaw`
      UPDATE "AgentTask"
      SET status = ${TaskStatus.CANCELLED}, "updatedAt" = NOW()
      WHERE id = ${taskId} AND status = ${TaskStatus.PENDING}
    `;

    // 从 Redis 队列移除
    const client = this.redis.getClient();
    if (client && this.redis.connected) {
      try {
        // 需要遍历队列找到并移除
        const tasks = await client.zrange(this.QUEUE_KEY, 0, -1);
        for (const taskJson of tasks) {
          const task = JSON.parse(taskJson);
          if (task.id === taskId) {
            await client.zrem(this.QUEUE_KEY, taskJson);
            break;
          }
        }
      } catch (err) {
        this.logger.error(`Failed to remove task from Redis: ${String(err)}`);
      }
    }

    return result > 0;
  }

  /**
   * 获取任务状态
   */
  async getStatus(taskId: string): Promise<Task | null> {
    const result = await this.prisma.$queryRaw<
      Array<{
        id: string;
        type: string;
        status: string;
        priority: number;
        payload: unknown;
        result: unknown;
        error: string | null;
        attempts: number;
        maxAttempts: number;
        scheduledAt: Date | null;
        startedAt: Date | null;
        completedAt: Date | null;
        createdAt: Date;
      }>
    >`
      SELECT * FROM "AgentTask" WHERE id = ${taskId}
    `;

    if (result.length === 0) return null;

    const row = result[0];
    return {
      id: row.id,
      type: row.type as TaskType,
      status: row.status as TaskStatus,
      priority: row.priority,
      payload: row.payload,
      result: row.result,
      error: row.error || undefined,
      attempts: row.attempts,
      maxAttempts: row.maxAttempts,
      scheduledAt: row.scheduledAt || undefined,
      startedAt: row.startedAt || undefined,
      completedAt: row.completedAt || undefined,
      createdAt: row.createdAt,
    };
  }

  /**
   * 获取队列统计
   */
  async getStats(): Promise<{
    pending: number;
    running: number;
    completed: number;
    failed: number;
    byType: Record<string, number>;
  }> {
    const [statusResult, typeResult] = await Promise.all([
      this.prisma.$queryRaw<Array<{ status: string; count: bigint }>>`
        SELECT status, COUNT(*) as count
        FROM "AgentTask"
        WHERE "createdAt" > NOW() - INTERVAL '24 hours'
        GROUP BY status
      `,
      this.prisma.$queryRaw<Array<{ type: string; count: bigint }>>`
        SELECT type, COUNT(*) as count
        FROM "AgentTask"
        WHERE status = ${TaskStatus.PENDING}
        GROUP BY type
      `,
    ]);

    const byStatus: Record<string, number> = {};
    for (const row of statusResult) {
      byStatus[row.status] = Number(row.count);
    }

    const byType: Record<string, number> = {};
    for (const row of typeResult) {
      byType[row.type] = Number(row.count);
    }

    return {
      pending: byStatus[TaskStatus.PENDING] || 0,
      running: byStatus[TaskStatus.RUNNING] || 0,
      completed: byStatus[TaskStatus.COMPLETED] || 0,
      failed: byStatus[TaskStatus.FAILED] || 0,
      byType,
    };
  }

  // ==================== 队列控制 ====================

  /**
   * 启动队列处理
   *
   * Uses adaptive setTimeout (not setInterval) so each tick re-schedules
   * itself at currentPollMs. That way the back-off below can lengthen
   * the cadence without restarting the interval.
   */
  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.currentPollMs = TaskQueueService.BASE_POLL_MS;
    this.emptyPollStreak = 0;
    this.schedulePoll();
    this.logger.log(
      `Task queue started (base ${this.currentPollMs}ms, max ${TaskQueueService.MAX_POLL_MS}ms with exponential back-off)`,
    );
  }

  /**
   * 停止队列处理
   */
  stop(): void {
    this.isRunning = false;
    if (this.pollInterval) {
      clearTimeout(this.pollInterval);
      this.pollInterval = null;
    }
    this.logger.log('Task queue stopped');
  }

  private schedulePoll(): void {
    if (!this.isRunning) return;
    this.pollInterval = setTimeout(
      () => void this.tickAndReschedule(),
      this.currentPollMs,
    );
  }

  private async tickAndReschedule(): Promise<void> {
    try {
      const picked = await this.poll();
      if (picked) {
        // Found work — reset to base cadence immediately
        this.currentPollMs = TaskQueueService.BASE_POLL_MS;
        this.emptyPollStreak = 0;
      } else {
        // Idle — back off geometrically, doubling up to MAX_POLL_MS.
        // This protects the Redis quota during long idle stretches.
        this.emptyPollStreak += 1;
        this.currentPollMs = Math.min(
          TaskQueueService.MAX_POLL_MS,
          TaskQueueService.BASE_POLL_MS *
            2 ** Math.min(this.emptyPollStreak, 4),
        );
      }
    } catch (err) {
      this.logger.error(`Tick error: ${String(err)}`);
    }
    this.schedulePoll();
  }

  // ==================== 内部方法 ====================

  /**
   * Single poll tick.
   *
   * @returns true if a task was picked up; false if idle. The return value
   *   drives the adaptive back-off in `tickAndReschedule()` — consecutive
   *   idle ticks geometrically lengthen the next interval.
   */
  private async poll(): Promise<boolean> {
    if (!this.isRunning || this.activeWorkers >= this.concurrency) {
      return false;
    }
    // Don't bother poking Redis if there are no registered handlers — no
    // module can possibly receive the task, so picking it would just retry-
    // loop until maxAttempts. Saves quota during boot.
    if (this.handlers.size === 0) {
      return false;
    }
    // Also skip if Redis circuit-breaker is open; reading would just hit
    // the quota error again and lengthen the breaker reset.
    if (!this.redis.connected) {
      return false;
    }

    try {
      // 1. 检查延迟任务
      await this.promoteDelayedTasks();

      // 2. 获取下一个任务
      const task = await this.getNextTask();
      if (!task) return false;

      // 3. 执行任务
      this.activeWorkers++;
      void this.executeTask(task).finally(() => {
        this.activeWorkers--;
      });
      return true;
    } catch (err) {
      this.logger.error(`Poll error: ${String(err)}`);
      return false;
    }
  }

  private async promoteDelayedTasks(): Promise<void> {
    const client = this.redis.getClient();
    if (!client || !this.redis.connected) return;

    try {
      const now = Date.now();
      const tasks = await client.zrangebyscore(this.DELAYED_KEY, 0, now);

      for (const taskJson of tasks) {
        const task = JSON.parse(taskJson);
        await client.zadd(this.QUEUE_KEY, -task.priority, taskJson);
        await client.zrem(this.DELAYED_KEY, taskJson);
      }
    } catch (err) {
      this.logger.debug(`Failed to promote delayed tasks: ${String(err)}`);
    }
  }

  private async getNextTask(): Promise<Task | null> {
    const client = this.redis.getClient();

    if (client && this.redis.connected) {
      try {
        // 从 Redis 获取
        const result = await client.zpopmin(this.QUEUE_KEY);
        if (result && result.length > 0) {
          return JSON.parse(result[0]);
        }
      } catch (err) {
        this.logger.debug(
          `Redis queue error, falling back to DB: ${String(err)}`,
        );
      }
    }

    // 降级：从数据库获取
    const result = await this.prisma.$queryRaw<
      Array<{
        id: string;
        type: string;
        payload: unknown;
        priority: number;
        attempts: number;
        maxAttempts: number;
        createdAt: Date;
      }>
    >`
      SELECT id, type, payload, priority, attempts, "maxAttempts", "createdAt"
      FROM "AgentTask"
      WHERE status = ${TaskStatus.PENDING}
        AND ("scheduledAt" IS NULL OR "scheduledAt" <= NOW())
      ORDER BY priority DESC, "createdAt" ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `;

    if (result.length === 0) return null;

    const row = result[0];
    return {
      id: row.id,
      type: row.type as TaskType,
      payload: row.payload,
      priority: row.priority,
      status: TaskStatus.PENDING,
      attempts: row.attempts,
      maxAttempts: row.maxAttempts,
      createdAt: row.createdAt,
    };
  }

  private async executeTask(task: Task): Promise<void> {
    const handler = this.handlers.get(task.type);
    if (!handler) {
      this.logger.error(`No handler for task type: ${task.type}`);
      await this.failTask(task, 'No handler registered');
      return;
    }

    // 更新状态为运行中
    await this.prisma.$executeRaw`
      UPDATE "AgentTask"
      SET status = ${TaskStatus.RUNNING},
          "startedAt" = NOW(),
          attempts = attempts + 1,
          "updatedAt" = NOW()
      WHERE id = ${task.id}
    `;

    try {
      const result = await handler(task.payload);

      if (result.success) {
        await this.completeTask(task, result.data);
      } else {
        await this.retryOrFail(task, result.error || 'Unknown error');
      }
    } catch (err) {
      await this.retryOrFail(
        task,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  private async completeTask(task: Task, result?: unknown): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE "AgentTask"
      SET status = ${TaskStatus.COMPLETED},
          result = ${JSON.stringify(result || {})}::jsonb,
          "completedAt" = NOW(),
          "updatedAt" = NOW()
      WHERE id = ${task.id}
    `;

    this.logger.debug(`Task completed: ${task.id}`);
  }

  private async retryOrFail(task: Task, error: string): Promise<void> {
    if (task.attempts < task.maxAttempts) {
      // 重试（指数退避）
      const delay = Math.pow(2, task.attempts) * 1000;
      await this.add(task.type, task.payload, {
        priority: task.priority,
        delay,
        maxAttempts: task.maxAttempts - task.attempts,
      });

      await this.prisma.$executeRaw`
        UPDATE "AgentTask"
        SET status = ${TaskStatus.PENDING},
            error = ${error},
            "updatedAt" = NOW()
        WHERE id = ${task.id}
      `;

      this.logger.debug(`Task ${task.id} scheduled for retry in ${delay}ms`);
    } else {
      await this.failTask(task, error);
    }
  }

  private async failTask(task: Task, error: string): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE "AgentTask"
      SET status = ${TaskStatus.FAILED},
          error = ${error},
          "completedAt" = NOW(),
          "updatedAt" = NOW()
      WHERE id = ${task.id}
    `;

    this.logger.error(`Task failed: ${task.id} - ${error}`);
  }

  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }
}
