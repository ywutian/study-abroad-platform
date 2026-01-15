/**
 * 弹性服务 - 重试、熔断、超时控制
 *
 * 熔断状态存储于 Redis（支持多实例共享）
 * Redis 不可用时降级为内存存储
 *
 * 特性:
 * - 分布式熔断状态同步
 * - 原子递增失败计数
 * - 自动降级到内存存储
 */

import { Injectable, Logger, Optional } from '@nestjs/common';
import { RedisService } from '../../../common/redis/redis.service';

// ==================== 存储接口 ====================

export interface CircuitBreakerStorage {
  getState(key: string): Promise<CircuitBreakerState | null>;
  setState(key: string, state: CircuitBreakerState, ttl: number): Promise<void>;
  incrementFailures(key: string): Promise<number>;
  resetFailures(key: string): Promise<void>;
}

// ==================== 重试配置 ====================

export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryableErrors?: string[];
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  retryableErrors: [
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    '429',
    '500',
    '502',
    '503',
    '504',
  ],
};

// ==================== 熔断器状态 ====================

enum CircuitState {
  CLOSED = 'CLOSED', // 正常
  OPEN = 'OPEN', // 熔断
  HALF_OPEN = 'HALF_OPEN', // 半开（测试恢复）
}

export interface CircuitBreakerConfig {
  failureThreshold: number; // 触发熔断的失败次数
  resetTimeoutMs: number; // 熔断后重置时间
  halfOpenRequests: number; // 半开状态允许的请求数
}

export interface CircuitBreakerState {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime: number;
  halfOpenAllowed: number;
}

const DEFAULT_CIRCUIT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeoutMs: 30000, // 30秒
  halfOpenRequests: 2,
};

// ==================== Redis 存储实现 ====================

class RedisCircuitStorage implements CircuitBreakerStorage {
  private readonly keyPrefix = 'circuit:';
  private readonly logger = new Logger(RedisCircuitStorage.name);

  constructor(private redis: RedisService) {}

  async getState(key: string): Promise<CircuitBreakerState | null> {
    const client = this.redis.getClient();
    if (!client || !this.redis.connected) return null;

    try {
      const raw = await client.get(`${this.keyPrefix}${key}`);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (err) {
      this.logger.debug(`Redis getState failed: ${err}`);
    }
    return null;
  }

  async setState(
    key: string,
    state: CircuitBreakerState,
    ttl: number,
  ): Promise<void> {
    const client = this.redis.getClient();
    if (!client || !this.redis.connected) return;

    try {
      await client.set(
        `${this.keyPrefix}${key}`,
        JSON.stringify(state),
        'EX',
        ttl,
      );
    } catch (err) {
      this.logger.debug(`Redis setState failed: ${err}`);
    }
  }

  async incrementFailures(key: string): Promise<number> {
    const client = this.redis.getClient();
    if (!client || !this.redis.connected) return 0;

    try {
      // 使用 Lua 脚本实现原子递增
      const script = `
        local data = redis.call('GET', KEYS[1])
        if not data then
          return 0
        end
        local state = cjson.decode(data)
        state.failures = state.failures + 1
        state.lastFailureTime = tonumber(ARGV[1])
        redis.call('SET', KEYS[1], cjson.encode(state), 'EX', tonumber(ARGV[2]))
        return state.failures
      `;

      const result = await client.eval(
        script,
        1,
        `${this.keyPrefix}${key}`,
        Date.now().toString(),
        '300',
      );
      return typeof result === 'number' ? result : 0;
    } catch (err) {
      this.logger.debug(`Redis incrementFailures failed: ${err}`);
      return 0;
    }
  }

  async resetFailures(key: string): Promise<void> {
    const client = this.redis.getClient();
    if (!client || !this.redis.connected) return;

    try {
      await client.del(`${this.keyPrefix}${key}`);
    } catch (err) {
      this.logger.debug(`Redis resetFailures failed: ${err}`);
    }
  }
}

// ==================== 内存存储实现 ====================

class MemoryCircuitStorage implements CircuitBreakerStorage {
  private circuits: Map<string, CircuitBreakerState> = new Map();

  async getState(key: string): Promise<CircuitBreakerState | null> {
    return this.circuits.get(key) || null;
  }

  async setState(
    key: string,
    state: CircuitBreakerState,
    _ttl: number,
  ): Promise<void> {
    // 内存存储不使用 TTL，依赖 Map 自动管理
    this.circuits.set(key, state);
  }

  async incrementFailures(key: string): Promise<number> {
    const state = this.circuits.get(key);
    if (!state) return 0;
    state.failures++;
    state.lastFailureTime = Date.now();
    return state.failures;
  }

  async resetFailures(key: string): Promise<void> {
    this.circuits.delete(key);
  }
}

// ==================== 服务实现 ====================

@Injectable()
export class ResilienceService {
  private readonly logger = new Logger(ResilienceService.name);

  // 存储实现（优先 Redis，降级内存）
  private primaryStorage: CircuitBreakerStorage;
  private fallbackStorage: MemoryCircuitStorage;
  private circuitConfigs: Map<string, CircuitBreakerConfig> = new Map();

  // 熔断状态 TTL：5分钟（足够覆盖重置周期）
  private readonly CIRCUIT_TTL = 300;

  constructor(@Optional() private redis: RedisService) {
    // 初始化存储
    this.fallbackStorage = new MemoryCircuitStorage();
    if (redis) {
      this.primaryStorage = new RedisCircuitStorage(redis);
    } else {
      this.primaryStorage = this.fallbackStorage;
    }
    this.logger.log(
      `Resilience service initialized (Redis: ${redis ? 'enabled' : 'disabled'})`,
    );
  }

  /**
   * 获取当前使用的存储类型
   */
  getStorageType(): 'redis' | 'memory' {
    if (this.redis?.connected) {
      return 'redis';
    }
    return 'memory';
  }

  /**
   * 带重试的执行
   */
  async withRetry<T>(
    fn: () => Promise<T>,
    config: Partial<RetryConfig> = {},
  ): Promise<T> {
    const cfg = { ...DEFAULT_RETRY_CONFIG, ...config };
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= cfg.maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // 检查是否可重试
        if (!this.isRetryable(lastError, cfg.retryableErrors)) {
          throw lastError;
        }

        // 最后一次不重试
        if (attempt === cfg.maxAttempts) {
          break;
        }

        // 指数退避延迟
        const delay = Math.min(
          cfg.baseDelayMs * Math.pow(2, attempt - 1),
          cfg.maxDelayMs,
        );

        this.logger.warn(
          `Retry attempt ${attempt}/${cfg.maxAttempts} after ${delay}ms: ${lastError.message}`,
        );

        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  /**
   * 带熔断的执行
   */
  async withCircuitBreaker<T>(
    serviceName: string,
    fn: () => Promise<T>,
    config: Partial<CircuitBreakerConfig> = {},
  ): Promise<T> {
    const cfg = this.getCircuitConfig(serviceName, config);
    const state = await this.getCircuitState(serviceName);

    // 检查熔断状态
    if (state.state === CircuitState.OPEN) {
      // 检查是否可以进入半开状态
      if (Date.now() - state.lastFailureTime >= cfg.resetTimeoutMs) {
        await this.transitionTo(
          serviceName,
          CircuitState.HALF_OPEN,
          cfg,
          state,
        );
      } else {
        throw new CircuitOpenError(serviceName);
      }
    }

    // 半开状态检查配额
    if (state.state === CircuitState.HALF_OPEN && state.halfOpenAllowed <= 0) {
      throw new CircuitOpenError(serviceName);
    }

    try {
      // 半开状态减少配额
      if (state.state === CircuitState.HALF_OPEN) {
        state.halfOpenAllowed--;
        await this.saveCircuitState(serviceName, state);
      }

      const result = await fn();
      await this.onSuccess(serviceName, cfg, state);
      return result;
    } catch (error) {
      await this.onFailure(serviceName, cfg, state);
      throw error;
    }
  }

  /**
   * 带超时的执行
   */
  async withTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number,
    operationName: string = 'operation',
  ): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) => {
        setTimeout(() => {
          reject(new TimeoutError(operationName, timeoutMs));
        }, timeoutMs);
      }),
    ]);
  }

  /**
   * 组合：重试 + 熔断 + 超时
   */
  async execute<T>(
    serviceName: string,
    fn: () => Promise<T>,
    options: {
      retry?: Partial<RetryConfig>;
      circuit?: Partial<CircuitBreakerConfig>;
      timeoutMs?: number;
    } = {},
  ): Promise<T> {
    const { retry, circuit, timeoutMs = 30000 } = options;

    // 最外层：熔断器
    return this.withCircuitBreaker(
      serviceName,
      async () => {
        // 中间层：重试
        return this.withRetry(async () => {
          // 最内层：超时
          return this.withTimeout(fn, timeoutMs, serviceName);
        }, retry);
      },
      circuit,
    );
  }

  /**
   * 获取熔断器状态（用于监控）
   */
  async getCircuitStatus(serviceName: string): Promise<{
    state: string;
    failures: number;
    isOpen: boolean;
  }> {
    const state = await this.getCircuitState(serviceName);
    return {
      state: state.state,
      failures: state.failures,
      isOpen: state.state === CircuitState.OPEN,
    };
  }

  /**
   * 手动重置熔断器
   */
  async resetCircuit(serviceName: string): Promise<void> {
    await this.getStorage().resetFailures(serviceName);
    await this.fallbackStorage.resetFailures(serviceName);
    this.logger.log(`Circuit breaker reset: ${serviceName}`);
  }

  // ==================== 私有方法 ====================

  /**
   * 获取当前可用的存储
   */
  private getStorage(): CircuitBreakerStorage {
    if (this.redis?.connected) {
      return this.primaryStorage;
    }
    return this.fallbackStorage;
  }

  private isRetryable(error: Error, retryableErrors?: string[]): boolean {
    const errorStr = error.message + (error.name || '');
    return (retryableErrors || []).some((code) => errorStr.includes(code));
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private getCircuitConfig(
    serviceName: string,
    override: Partial<CircuitBreakerConfig>,
  ): CircuitBreakerConfig {
    if (!this.circuitConfigs.has(serviceName)) {
      this.circuitConfigs.set(serviceName, {
        ...DEFAULT_CIRCUIT_CONFIG,
        ...override,
      });
    }
    return this.circuitConfigs.get(serviceName)!;
  }

  private async getCircuitState(
    serviceName: string,
  ): Promise<CircuitBreakerState> {
    const storage = this.getStorage();

    // 尝试从主存储获取
    let state = await storage.getState(serviceName);

    // 如果主存储没有，尝试从降级存储获取
    if (!state && storage !== this.fallbackStorage) {
      state = await this.fallbackStorage.getState(serviceName);
    }

    // 如果都没有，创建初始状态
    if (!state) {
      state = this.createInitialState();
      await this.saveCircuitState(serviceName, state);
    }

    return state;
  }

  private async saveCircuitState(
    serviceName: string,
    state: CircuitBreakerState,
  ): Promise<void> {
    const storage = this.getStorage();
    await storage.setState(serviceName, state, this.CIRCUIT_TTL);

    // 同时保存到降级存储，确保一致性
    if (storage !== this.fallbackStorage) {
      await this.fallbackStorage.setState(serviceName, state, this.CIRCUIT_TTL);
    }
  }

  private createInitialState(): CircuitBreakerState {
    return {
      state: CircuitState.CLOSED,
      failures: 0,
      successes: 0,
      lastFailureTime: 0,
      halfOpenAllowed: 0,
    };
  }

  private async transitionTo(
    serviceName: string,
    newState: CircuitState,
    config: CircuitBreakerConfig,
    state: CircuitBreakerState,
  ): Promise<void> {
    const oldState = state.state;
    state.state = newState;

    if (newState === CircuitState.HALF_OPEN) {
      state.halfOpenAllowed = config.halfOpenRequests;
      state.successes = 0;
    } else if (newState === CircuitState.CLOSED) {
      state.failures = 0;
      state.successes = 0;
    }

    await this.saveCircuitState(serviceName, state);
    this.logger.log(`Circuit ${serviceName}: ${oldState} -> ${newState}`);
  }

  private async onSuccess(
    serviceName: string,
    config: CircuitBreakerConfig,
    state: CircuitBreakerState,
  ): Promise<void> {
    if (state.state === CircuitState.HALF_OPEN) {
      state.successes++;
      if (state.successes >= config.halfOpenRequests) {
        await this.transitionTo(
          serviceName,
          CircuitState.CLOSED,
          config,
          state,
        );
      } else {
        await this.saveCircuitState(serviceName, state);
      }
    }
  }

  private async onFailure(
    serviceName: string,
    config: CircuitBreakerConfig,
    state: CircuitBreakerState,
  ): Promise<void> {
    state.failures++;
    state.lastFailureTime = Date.now();

    if (state.state === CircuitState.HALF_OPEN) {
      await this.transitionTo(serviceName, CircuitState.OPEN, config, state);
    } else if (state.failures >= config.failureThreshold) {
      await this.transitionTo(serviceName, CircuitState.OPEN, config, state);
    } else {
      await this.saveCircuitState(serviceName, state);
    }
  }
}

// ==================== 自定义错误 ====================

export class CircuitOpenError extends Error {
  constructor(serviceName: string) {
    super(`Circuit breaker is open for service: ${serviceName}`);
    this.name = 'CircuitOpenError';
  }
}

export class TimeoutError extends Error {
  constructor(operationName: string, timeoutMs: number) {
    super(`Operation "${operationName}" timed out after ${timeoutMs}ms`);
    this.name = 'TimeoutError';
  }
}
