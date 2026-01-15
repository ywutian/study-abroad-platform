/**
 * Agent 指标收集服务
 *
 * 收集关键业务和性能指标
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { getRequestId, getRequestDuration } from '../context';

// ==================== 指标类型 ====================

interface Counter {
  value: number;
  labels: Record<string, string>;
}

interface Histogram {
  count: number;
  sum: number;
  buckets: Map<number, number>; // bucket -> count
}

interface Gauge {
  value: number;
  timestamp: number;
}

// ==================== 预定义指标 ====================

const HISTOGRAM_BUCKETS = [
  10, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 30000,
];

export interface AgentMetrics {
  // 请求指标
  requests: {
    total: number;
    byStatus: Record<string, number>;
    byAgent: Record<string, number>;
  };

  // 延迟指标
  latency: {
    llm: Histogram;
    tool: Histogram;
    total: Histogram;
  };

  // Token 指标
  tokens: {
    prompt: number;
    completion: number;
    total: number;
    byModel: Record<string, number>;
  };

  // 错误指标
  errors: {
    total: number;
    byType: Record<string, number>;
    byAgent: Record<string, number>;
  };

  // 系统指标
  system: {
    activeRequests: number;
    circuitBreakerState: Record<string, string>;
    rateLimitHits: number;
    quotaExceeded: number;
  };
}

@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly logger = new Logger(MetricsService.name);

  private metrics: AgentMetrics = this.createEmptyMetrics();
  private startTime = Date.now();

  onModuleInit() {
    // 定期打印指标摘要
    setInterval(() => {
      this.logMetricsSummary();
    }, 60000);
  }

  // ==================== 请求指标 ====================

  recordRequest(
    agentType: string,
    status: 'success' | 'error' | 'timeout' | 'rate_limited',
  ) {
    this.metrics.requests.total++;
    this.metrics.requests.byStatus[status] =
      (this.metrics.requests.byStatus[status] || 0) + 1;
    this.metrics.requests.byAgent[agentType] =
      (this.metrics.requests.byAgent[agentType] || 0) + 1;
  }

  // ==================== 延迟指标 ====================

  recordLLMLatency(durationMs: number) {
    this.recordHistogram(this.metrics.latency.llm, durationMs);
  }

  recordToolLatency(toolName: string, durationMs: number) {
    this.recordHistogram(this.metrics.latency.tool, durationMs);
  }

  recordTotalLatency(durationMs: number) {
    this.recordHistogram(this.metrics.latency.total, durationMs);
  }

  // ==================== Token 指标 ====================

  recordTokens(prompt: number, completion: number, model: string) {
    this.metrics.tokens.prompt += prompt;
    this.metrics.tokens.completion += completion;
    this.metrics.tokens.total += prompt + completion;
    this.metrics.tokens.byModel[model] =
      (this.metrics.tokens.byModel[model] || 0) + prompt + completion;
  }

  // ==================== 错误指标 ====================

  recordError(errorType: string, agentType?: string) {
    this.metrics.errors.total++;
    this.metrics.errors.byType[errorType] =
      (this.metrics.errors.byType[errorType] || 0) + 1;
    if (agentType) {
      this.metrics.errors.byAgent[agentType] =
        (this.metrics.errors.byAgent[agentType] || 0) + 1;
    }
  }

  // ==================== 系统指标 ====================

  setActiveRequests(count: number) {
    this.metrics.system.activeRequests = count;
  }

  setCircuitBreakerState(service: string, state: string) {
    this.metrics.system.circuitBreakerState[service] = state;
  }

  recordRateLimitHit() {
    this.metrics.system.rateLimitHits++;
  }

  recordQuotaExceeded() {
    this.metrics.system.quotaExceeded++;
  }

  // ==================== 导出 ====================

  getMetrics(): AgentMetrics {
    return { ...this.metrics };
  }

  getPrometheusFormat(): string {
    const lines: string[] = [];
    const prefix = 'agent_';

    // 请求计数
    lines.push(`# HELP ${prefix}requests_total Total number of requests`);
    lines.push(`# TYPE ${prefix}requests_total counter`);
    lines.push(`${prefix}requests_total ${this.metrics.requests.total}`);

    for (const [status, count] of Object.entries(
      this.metrics.requests.byStatus,
    )) {
      lines.push(`${prefix}requests_total{status="${status}"} ${count}`);
    }

    for (const [agent, count] of Object.entries(
      this.metrics.requests.byAgent,
    )) {
      lines.push(`${prefix}requests_total{agent="${agent}"} ${count}`);
    }

    // Token 计数
    lines.push(`# HELP ${prefix}tokens_total Total tokens used`);
    lines.push(`# TYPE ${prefix}tokens_total counter`);
    lines.push(
      `${prefix}tokens_total{type="prompt"} ${this.metrics.tokens.prompt}`,
    );
    lines.push(
      `${prefix}tokens_total{type="completion"} ${this.metrics.tokens.completion}`,
    );

    // 延迟直方图
    lines.push(`# HELP ${prefix}llm_duration_ms LLM call duration`);
    lines.push(`# TYPE ${prefix}llm_duration_ms histogram`);
    this.appendHistogramLines(
      lines,
      `${prefix}llm_duration_ms`,
      this.metrics.latency.llm,
    );

    // 错误计数
    lines.push(`# HELP ${prefix}errors_total Total errors`);
    lines.push(`# TYPE ${prefix}errors_total counter`);
    lines.push(`${prefix}errors_total ${this.metrics.errors.total}`);

    for (const [type, count] of Object.entries(this.metrics.errors.byType)) {
      lines.push(`${prefix}errors_total{type="${type}"} ${count}`);
    }

    // 系统指标
    lines.push(`# HELP ${prefix}active_requests Current active requests`);
    lines.push(`# TYPE ${prefix}active_requests gauge`);
    lines.push(
      `${prefix}active_requests ${this.metrics.system.activeRequests}`,
    );

    return lines.join('\n');
  }

  reset() {
    this.metrics = this.createEmptyMetrics();
    this.startTime = Date.now();
  }

  // ==================== 私有方法 ====================

  private createEmptyMetrics(): AgentMetrics {
    return {
      requests: { total: 0, byStatus: {}, byAgent: {} },
      latency: {
        llm: this.createHistogram(),
        tool: this.createHistogram(),
        total: this.createHistogram(),
      },
      tokens: { prompt: 0, completion: 0, total: 0, byModel: {} },
      errors: { total: 0, byType: {}, byAgent: {} },
      system: {
        activeRequests: 0,
        circuitBreakerState: {},
        rateLimitHits: 0,
        quotaExceeded: 0,
      },
    };
  }

  private createHistogram(): Histogram {
    const buckets = new Map<number, number>();
    HISTOGRAM_BUCKETS.forEach((b) => buckets.set(b, 0));
    return { count: 0, sum: 0, buckets };
  }

  private recordHistogram(histogram: Histogram, value: number) {
    histogram.count++;
    histogram.sum += value;
    for (const bucket of HISTOGRAM_BUCKETS) {
      if (value <= bucket) {
        histogram.buckets.set(bucket, (histogram.buckets.get(bucket) || 0) + 1);
      }
    }
  }

  private appendHistogramLines(
    lines: string[],
    name: string,
    histogram: Histogram,
  ) {
    for (const [bucket, count] of histogram.buckets.entries()) {
      lines.push(`${name}_bucket{le="${bucket}"} ${count}`);
    }
    lines.push(`${name}_bucket{le="+Inf"} ${histogram.count}`);
    lines.push(`${name}_sum ${histogram.sum}`);
    lines.push(`${name}_count ${histogram.count}`);
  }

  private logMetricsSummary() {
    const uptime = Math.round((Date.now() - this.startTime) / 1000);
    const avgLatency =
      this.metrics.latency.total.count > 0
        ? Math.round(
            this.metrics.latency.total.sum / this.metrics.latency.total.count,
          )
        : 0;
    const errorRate =
      this.metrics.requests.total > 0
        ? (
            (this.metrics.errors.total / this.metrics.requests.total) *
            100
          ).toFixed(2)
        : '0.00';

    this.logger.log(
      `[Metrics] uptime=${uptime}s requests=${this.metrics.requests.total} ` +
        `tokens=${this.metrics.tokens.total} errors=${this.metrics.errors.total} (${errorRate}%) ` +
        `avgLatency=${avgLatency}ms active=${this.metrics.system.activeRequests}`,
    );
  }
}
