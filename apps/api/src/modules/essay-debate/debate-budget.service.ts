import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../common/redis/redis.service';

/**
 * Two hard caps from the 27-agent debate verdict:
 *
 *  - Per-user: 30 debate turns per UTC day. Prevents one zealous user from
 *    monopolising the model.
 *  - System-wide: $40 of estimated spend per UTC day. The first time we hit
 *    this we want the API to fail-closed instead of silently overspending —
 *    PR2's cost-per-turn estimate will replace the 1 cent placeholder here.
 *
 * Both counters live in Redis with a 24h TTL on first INCR (date-keyed),
 * so they auto-reset at the day boundary. If Redis is unhealthy we
 * fail-open per the rest of the codebase — the `incr` helpers in
 * `RedisService` already return 0 / no-op on failure, which we treat as
 * "we don't know — let the request through". PR2 will tighten this once
 * we trust the metric.
 */
export const DAILY_USER_TURN_CAP = 30;
export const DAILY_SYSTEM_CENT_CAP = 4000; // $40
export const DAY_SECONDS = 24 * 60 * 60;

export interface BudgetOk {
  ok: true;
  remaining: number;
}

export interface BudgetExceeded {
  ok: false;
  reason: 'user_daily_cap' | 'system_daily_cap';
  remaining: 0;
}

export type BudgetResult = BudgetOk | BudgetExceeded;

@Injectable()
export class DebateBudgetService {
  private readonly logger = new Logger(DebateBudgetService.name);

  constructor(private readonly redis: RedisService) {}

  private todayKey(): string {
    // YYYY-MM-DD in UTC — independent of host time zone.
    return new Date().toISOString().slice(0, 10);
  }

  private userKey(userId: string): string {
    return `debate:user:${userId}:turns:${this.todayKey()}`;
  }

  private globalKey(): string {
    return `debate:global:cents:${this.todayKey()}`;
  }

  /**
   * Reserve one turn for this user. Atomic INCR + EXPIRE on first hit.
   * Returns `{ ok: false, reason: 'user_daily_cap' }` if the increment
   * pushed the user over `DAILY_USER_TURN_CAP`.
   */
  async incrementUserTurn(userId: string): Promise<BudgetResult> {
    const key = this.userKey(userId);
    const next = await this.redis.incr(key);
    // Only set TTL on the first increment of the day to avoid resetting
    // the window on every call.
    if (next === 1) {
      await this.redis.expire(key, DAY_SECONDS);
    }
    if (next > DAILY_USER_TURN_CAP) {
      return { ok: false, reason: 'user_daily_cap', remaining: 0 };
    }
    return { ok: true, remaining: DAILY_USER_TURN_CAP - next };
  }

  /**
   * Reserve estimated spend in cents against the system-wide $40/day cap.
   * Skeleton uses `estCents = 1` per turn — PR2 will compute from real
   * model usage (input tokens × $/Mt + output tokens × $/Mt, rounded up).
   */
  async incrementGlobalSpend(estCents: number): Promise<BudgetResult> {
    const safeAmount = Math.max(1, Math.floor(estCents));
    const key = this.globalKey();
    // No `incrby` helper on RedisService — emulate by N incr() calls when
    // safeAmount > 1. For the PR1 default (1 cent) this is a single call.
    let next = 0;
    for (let i = 0; i < safeAmount; i++) {
      next = await this.redis.incr(key);
      if (i === 0 && next === 1) {
        await this.redis.expire(key, DAY_SECONDS);
      }
    }
    if (next > DAILY_SYSTEM_CENT_CAP) {
      return { ok: false, reason: 'system_daily_cap', remaining: 0 };
    }
    return { ok: true, remaining: DAILY_SYSTEM_CENT_CAP - next };
  }

  /**
   * Read-only helpers for tests + admin pages. Don't increment.
   */
  async getUserTurnsToday(userId: string): Promise<number> {
    const raw = await this.redis.get(this.userKey(userId));
    return raw ? Number(raw) || 0 : 0;
  }

  async getGlobalCentsToday(): Promise<number> {
    const raw = await this.redis.get(this.globalKey());
    return raw ? Number(raw) || 0 : 0;
  }
}
