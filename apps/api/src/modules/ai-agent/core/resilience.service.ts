/**
 * 弹性服务 - 重试、熔断、超时控制
 */

import { Injectable, Logger } from '@nestjs/common';

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
  retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', '429', '500', '502', '503', '504'],
};

// ==================== 熔断器状态 ====================

enum CircuitState {
  CLOSED = 'CLOSED',     // 正常
  OPEN = 'OPEN',         // 熔断
  HALF_OPEN = 'HALF_OPEN', // 半开（测试恢复）
}

interface CircuitBreakerConfig {
  failureThreshold: number;  // 触发熔断的失败次数
  resetTimeoutMs: number;    // 熔断后重置时间
  halfOpenRequests: number;  // 半开状态允许的请求数
}

interface CircuitBreakerState {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime: number;
  halfOpenAllowed: number;
}

const DEFAULT_CIRCUIT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeoutMs: 30000,  // 30秒
  halfOpenRequests: 2,
};

// ==================== 服务实现 ====================

@Injectable()
export class ResilienceService {
  private readonly logger = new Logger(ResilienceService.name);
  
  // 熔断器状态存储 (按服务名)
  private circuits: Map<string, CircuitBreakerState> = new Map();
  private circuitConfigs: Map<string, CircuitBreakerConfig> = new Map();

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
    const state = this.getCircuitState(serviceName);

    // 检查熔断状态
    if (state.state === CircuitState.OPEN) {
      // 检查是否可以进入半开状态
      if (Date.now() - state.lastFailureTime >= cfg.resetTimeoutMs) {
        this.transitionTo(serviceName, CircuitState.HALF_OPEN, cfg);
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
      }

      const result = await fn();
      this.onSuccess(serviceName, cfg);
      return result;
    } catch (error) {
      this.onFailure(serviceName, cfg);
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
    return this.withCircuitBreaker(serviceName, async () => {
      // 中间层：重试
      return this.withRetry(async () => {
        // 最内层：超时
        return this.withTimeout(fn, timeoutMs, serviceName);
      }, retry);
    }, circuit);
  }

  /**
   * 获取熔断器状态（用于监控）
   */
  getCircuitStatus(serviceName: string): {
    state: string;
    failures: number;
    isOpen: boolean;
  } {
    const state = this.circuits.get(serviceName);
    return {
      state: state?.state || CircuitState.CLOSED,
      failures: state?.failures || 0,
      isOpen: state?.state === CircuitState.OPEN,
    };
  }

  /**
   * 手动重置熔断器
   */
  resetCircuit(serviceName: string): void {
    this.circuits.delete(serviceName);
    this.logger.log(`Circuit breaker reset: ${serviceName}`);
  }

  // ==================== 私有方法 ====================

  private isRetryable(error: Error, retryableErrors?: string[]): boolean {
    const errorStr = error.message + (error.name || '');
    return (retryableErrors || []).some(code => errorStr.includes(code));
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private getCircuitConfig(
    serviceName: string,
    override: Partial<CircuitBreakerConfig>,
  ): CircuitBreakerConfig {
    if (!this.circuitConfigs.has(serviceName)) {
      this.circuitConfigs.set(serviceName, { ...DEFAULT_CIRCUIT_CONFIG, ...override });
    }
    return this.circuitConfigs.get(serviceName)!;
  }

  private getCircuitState(serviceName: string): CircuitBreakerState {
    if (!this.circuits.has(serviceName)) {
      this.circuits.set(serviceName, {
        state: CircuitState.CLOSED,
        failures: 0,
        successes: 0,
        lastFailureTime: 0,
        halfOpenAllowed: 0,
      });
    }
    return this.circuits.get(serviceName)!;
  }

  private transitionTo(
    serviceName: string,
    newState: CircuitState,
    config: CircuitBreakerConfig,
  ): void {
    const state = this.getCircuitState(serviceName);
    const oldState = state.state;
    state.state = newState;

    if (newState === CircuitState.HALF_OPEN) {
      state.halfOpenAllowed = config.halfOpenRequests;
      state.successes = 0;
    } else if (newState === CircuitState.CLOSED) {
      state.failures = 0;
      state.successes = 0;
    }

    this.logger.log(`Circuit ${serviceName}: ${oldState} -> ${newState}`);
  }

  private onSuccess(serviceName: string, config: CircuitBreakerConfig): void {
    const state = this.getCircuitState(serviceName);
    
    if (state.state === CircuitState.HALF_OPEN) {
      state.successes++;
      if (state.successes >= config.halfOpenRequests) {
        this.transitionTo(serviceName, CircuitState.CLOSED, config);
      }
    }
  }

  private onFailure(serviceName: string, config: CircuitBreakerConfig): void {
    const state = this.getCircuitState(serviceName);
    state.failures++;
    state.lastFailureTime = Date.now();

    if (state.state === CircuitState.HALF_OPEN) {
      this.transitionTo(serviceName, CircuitState.OPEN, config);
    } else if (state.failures >= config.failureThreshold) {
      this.transitionTo(serviceName, CircuitState.OPEN, config);
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


