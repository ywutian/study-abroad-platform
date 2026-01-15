/**
 * Prometheus 指标服务
 *
 * 企业级监控指标收集：
 * - 请求计数与延迟
 * - Token 使用量
 * - Agent 性能
 * - 记忆系统指标
 * - 错误率与可用性
 * - 业务指标
 */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// ==================== 类型定义 ====================

export interface MetricLabels {
  [key: string]: string | number;
}

export interface HistogramBuckets {
  buckets: number[];
}

interface CounterMetric {
  type: 'counter';
  name: string;
  help: string;
  labels: string[];
  values: Map<string, number>;
}

interface GaugeMetric {
  type: 'gauge';
  name: string;
  help: string;
  labels: string[];
  values: Map<string, number>;
}

interface HistogramMetric {
  type: 'histogram';
  name: string;
  help: string;
  labels: string[];
  buckets: number[];
  values: Map<string, { sum: number; count: number; buckets: number[] }>;
}

type Metric = CounterMetric | GaugeMetric | HistogramMetric;

// ==================== 默认桶配置 ====================

const DEFAULT_LATENCY_BUCKETS = [
  5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000,
];
const DEFAULT_TOKEN_BUCKETS = [100, 500, 1000, 2000, 5000, 10000, 20000, 50000];

// ==================== 服务实现 ====================

@Injectable()
export class PrometheusMetricsService implements OnModuleInit {
  private metrics: Map<string, Metric> = new Map();
  private readonly prefix: string;
  private readonly enabled: boolean;

  constructor(private config: ConfigService) {
    this.prefix = this.config.get('METRICS_PREFIX', 'ai_agent');
    this.enabled = this.config.get('METRICS_ENABLED', 'true') === 'true';
  }

  onModuleInit(): void {
    this.registerDefaultMetrics();
  }

  // ==================== 指标注册 ====================

  private registerDefaultMetrics(): void {
    // ========== 请求指标 ==========
    this.registerCounter('requests_total', 'Total number of requests', [
      'agent_type',
      'status',
    ]);

    this.registerHistogram(
      'request_duration_ms',
      'Request duration in milliseconds',
      ['agent_type'],
      { buckets: DEFAULT_LATENCY_BUCKETS },
    );

    this.registerCounter(
      'request_errors_total',
      'Total number of request errors',
      ['agent_type', 'error_code'],
    );

    // ========== LLM 指标 ==========
    this.registerCounter('llm_calls_total', 'Total number of LLM API calls', [
      'model',
      'status',
    ]);

    this.registerHistogram(
      'llm_latency_ms',
      'LLM API call latency in milliseconds',
      ['model'],
      { buckets: DEFAULT_LATENCY_BUCKETS },
    );

    this.registerHistogram(
      'llm_tokens_prompt',
      'Prompt tokens per LLM call',
      ['model'],
      { buckets: DEFAULT_TOKEN_BUCKETS },
    );

    this.registerHistogram(
      'llm_tokens_completion',
      'Completion tokens per LLM call',
      ['model'],
      { buckets: DEFAULT_TOKEN_BUCKETS },
    );

    this.registerGauge('llm_cost_usd', 'Estimated LLM cost in USD', [
      'model',
      'period',
    ]);

    // ========== 工具指标 ==========
    this.registerCounter('tool_calls_total', 'Total number of tool calls', [
      'tool_name',
      'status',
    ]);

    this.registerHistogram(
      'tool_duration_ms',
      'Tool execution duration in milliseconds',
      ['tool_name'],
      { buckets: DEFAULT_LATENCY_BUCKETS },
    );

    // ========== Agent 指标 ==========
    this.registerGauge(
      'agent_active_conversations',
      'Number of active conversations',
      ['agent_type'],
    );

    this.registerCounter(
      'agent_delegations_total',
      'Total number of agent delegations',
      ['from_agent', 'to_agent'],
    );

    this.registerHistogram(
      'agent_iterations',
      'Number of ReAct loop iterations per request',
      ['agent_type'],
      { buckets: [1, 2, 3, 5, 7, 10, 15, 20] },
    );

    // ========== 记忆系统指标 ==========
    this.registerGauge('memory_total_count', 'Total number of memories', [
      'user_id',
      'type',
    ]);

    this.registerHistogram(
      'memory_query_duration_ms',
      'Memory query duration in milliseconds',
      ['operation'],
      { buckets: [1, 5, 10, 25, 50, 100, 250, 500] },
    );

    this.registerCounter(
      'memory_operations_total',
      'Total number of memory operations',
      ['operation', 'status'],
    );

    this.registerGauge('memory_cache_hit_ratio', 'Memory cache hit ratio', [
      'cache_type',
    ]);

    this.registerHistogram(
      'memory_embedding_duration_ms',
      'Embedding generation duration',
      [],
      { buckets: [10, 25, 50, 100, 200, 500, 1000] },
    );

    // ========== 限流与熔断 ==========
    this.registerCounter(
      'rate_limit_exceeded_total',
      'Total number of rate limit exceeded events',
      ['user_id', 'limit_type'],
    );

    this.registerGauge(
      'circuit_breaker_state',
      'Circuit breaker state (0=closed, 1=half-open, 2=open)',
      ['service'],
    );

    // ========== 系统指标 ==========
    this.registerGauge(
      'system_memory_usage_bytes',
      'System memory usage in bytes',
      ['type'],
    );

    this.registerGauge(
      'system_cpu_usage_percent',
      'System CPU usage percentage',
      [],
    );
  }

  // ==================== 指标类型注册 ====================

  registerCounter(name: string, help: string, labels: string[] = []): void {
    const fullName = `${this.prefix}_${name}`;
    this.metrics.set(fullName, {
      type: 'counter',
      name: fullName,
      help,
      labels,
      values: new Map(),
    });
  }

  registerGauge(name: string, help: string, labels: string[] = []): void {
    const fullName = `${this.prefix}_${name}`;
    this.metrics.set(fullName, {
      type: 'gauge',
      name: fullName,
      help,
      labels,
      values: new Map(),
    });
  }

  registerHistogram(
    name: string,
    help: string,
    labels: string[] = [],
    options?: HistogramBuckets,
  ): void {
    const fullName = `${this.prefix}_${name}`;
    this.metrics.set(fullName, {
      type: 'histogram',
      name: fullName,
      help,
      labels,
      buckets: options?.buckets || DEFAULT_LATENCY_BUCKETS,
      values: new Map(),
    });
  }

  // ==================== 指标操作 ====================

  incCounter(name: string, labels: MetricLabels = {}, value = 1): void {
    if (!this.enabled) return;
    const metric = this.metrics.get(`${this.prefix}_${name}`);
    if (!metric || metric.type !== 'counter') return;

    const key = this.labelsToKey(labels);
    const current = metric.values.get(key) || 0;
    metric.values.set(key, current + value);
  }

  setGauge(name: string, value: number, labels: MetricLabels = {}): void {
    if (!this.enabled) return;
    const metric = this.metrics.get(`${this.prefix}_${name}`);
    if (!metric || metric.type !== 'gauge') return;

    const key = this.labelsToKey(labels);
    metric.values.set(key, value);
  }

  incGauge(name: string, labels: MetricLabels = {}, value = 1): void {
    if (!this.enabled) return;
    const metric = this.metrics.get(`${this.prefix}_${name}`);
    if (!metric || metric.type !== 'gauge') return;

    const key = this.labelsToKey(labels);
    const current = metric.values.get(key) || 0;
    metric.values.set(key, current + value);
  }

  decGauge(name: string, labels: MetricLabels = {}, value = 1): void {
    this.incGauge(name, labels, -value);
  }

  observeHistogram(
    name: string,
    value: number,
    labels: MetricLabels = {},
  ): void {
    if (!this.enabled) return;
    const metric = this.metrics.get(`${this.prefix}_${name}`);
    if (!metric || metric.type !== 'histogram') return;

    const key = this.labelsToKey(labels);
    let data = metric.values.get(key);

    if (!data) {
      data = {
        sum: 0,
        count: 0,
        buckets: new Array(metric.buckets.length).fill(0),
      };
      metric.values.set(key, data);
    }

    data.sum += value;
    data.count += 1;

    // 更新桶
    for (let i = 0; i < metric.buckets.length; i++) {
      if (value <= metric.buckets[i]) {
        data.buckets[i]++;
      }
    }
  }

  // ==================== 便捷方法 ====================

  /**
   * 记录请求
   */
  recordRequest(
    agentType: string,
    status: 'success' | 'error',
    durationMs: number,
  ): void {
    this.incCounter('requests_total', { agent_type: agentType, status });
    this.observeHistogram('request_duration_ms', durationMs, {
      agent_type: agentType,
    });
    if (status === 'error') {
      this.incCounter('request_errors_total', {
        agent_type: agentType,
        error_code: 'unknown',
      });
    }
  }

  /**
   * 记录请求错误
   */
  recordRequestError(agentType: string, errorCode: string): void {
    this.incCounter('request_errors_total', {
      agent_type: agentType,
      error_code: errorCode,
    });
  }

  /**
   * 记录 LLM 调用
   */
  recordLLMCall(
    model: string,
    status: 'success' | 'error',
    durationMs: number,
    tokens: { prompt: number; completion: number },
  ): void {
    this.incCounter('llm_calls_total', { model, status });
    this.observeHistogram('llm_latency_ms', durationMs, { model });
    this.observeHistogram('llm_tokens_prompt', tokens.prompt, { model });
    this.observeHistogram('llm_tokens_completion', tokens.completion, {
      model,
    });
  }

  /**
   * 记录工具调用
   */
  recordToolCall(
    toolName: string,
    status: 'success' | 'error',
    durationMs: number,
  ): void {
    this.incCounter('tool_calls_total', { tool_name: toolName, status });
    this.observeHistogram('tool_duration_ms', durationMs, {
      tool_name: toolName,
    });
  }

  /**
   * 记录 Agent 委派
   */
  recordDelegation(fromAgent: string, toAgent: string): void {
    this.incCounter('agent_delegations_total', {
      from_agent: fromAgent,
      to_agent: toAgent,
    });
  }

  /**
   * 记录记忆操作
   */
  recordMemoryOperation(
    operation: 'create' | 'read' | 'update' | 'delete' | 'search',
    status: 'success' | 'error',
    durationMs: number,
  ): void {
    this.incCounter('memory_operations_total', { operation, status });
    this.observeHistogram('memory_query_duration_ms', durationMs, {
      operation,
    });
  }

  /**
   * 记录限流事件
   */
  recordRateLimitExceeded(
    userId: string,
    limitType: 'user' | 'conversation' | 'global',
  ): void {
    this.incCounter('rate_limit_exceeded_total', {
      user_id: userId,
      limit_type: limitType,
    });
  }

  /**
   * 设置熔断器状态
   */
  setCircuitBreakerState(
    service: string,
    state: 'closed' | 'half-open' | 'open',
  ): void {
    const stateValue = { closed: 0, 'half-open': 1, open: 2 }[state];
    this.setGauge('circuit_breaker_state', stateValue, { service });
  }

  /**
   * 更新系统指标
   */
  updateSystemMetrics(): void {
    const memUsage = process.memoryUsage();
    this.setGauge('system_memory_usage_bytes', memUsage.heapUsed, {
      type: 'heap_used',
    });
    this.setGauge('system_memory_usage_bytes', memUsage.heapTotal, {
      type: 'heap_total',
    });
    this.setGauge('system_memory_usage_bytes', memUsage.rss, { type: 'rss' });
  }

  // ==================== 导出 ====================

  /**
   * 导出 Prometheus 格式指标
   */
  exportPrometheus(): string {
    const lines: string[] = [];

    for (const metric of this.metrics.values()) {
      // HELP 行
      lines.push(`# HELP ${metric.name} ${metric.help}`);
      // TYPE 行
      lines.push(`# TYPE ${metric.name} ${metric.type}`);

      if (metric.type === 'counter' || metric.type === 'gauge') {
        for (const [key, value] of metric.values) {
          const labelStr = key ? `{${key}}` : '';
          lines.push(`${metric.name}${labelStr} ${value}`);
        }
      } else if (metric.type === 'histogram') {
        for (const [key, data] of metric.values) {
          const labelStr = key ? `${key},` : '';

          // 桶
          let cumulative = 0;
          for (let i = 0; i < metric.buckets.length; i++) {
            cumulative += data.buckets[i];
            lines.push(
              `${metric.name}_bucket{${labelStr}le="${metric.buckets[i]}"} ${cumulative}`,
            );
          }
          lines.push(
            `${metric.name}_bucket{${labelStr}le="+Inf"} ${data.count}`,
          );

          // sum 和 count
          lines.push(`${metric.name}_sum{${key || ''}} ${data.sum}`);
          lines.push(`${metric.name}_count{${key || ''}} ${data.count}`);
        }
      }

      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * 导出 JSON 格式指标
   */
  exportJSON(): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [name, metric] of this.metrics) {
      if (metric.type === 'histogram') {
        result[name] = Array.from(metric.values.entries()).map(
          ([key, data]) => ({
            labels: this.keyToLabels(key),
            sum: data.sum,
            count: data.count,
            mean: data.count > 0 ? data.sum / data.count : 0,
          }),
        );
      } else {
        result[name] = Array.from(metric.values.entries()).map(
          ([key, value]) => ({
            labels: this.keyToLabels(key),
            value,
          }),
        );
      }
    }

    return result;
  }

  // ==================== 私有方法 ====================

  private labelsToKey(labels: MetricLabels): string {
    const entries = Object.entries(labels).sort((a, b) =>
      a[0].localeCompare(b[0]),
    );
    return entries.map(([k, v]) => `${k}="${v}"`).join(',');
  }

  private keyToLabels(key: string): MetricLabels {
    if (!key) return {};
    const labels: MetricLabels = {};
    const parts = key.split(',');
    for (const part of parts) {
      const [k, v] = part.split('=');
      if (k && v) {
        labels[k] = v.replace(/"/g, '');
      }
    }
    return labels;
  }
}
