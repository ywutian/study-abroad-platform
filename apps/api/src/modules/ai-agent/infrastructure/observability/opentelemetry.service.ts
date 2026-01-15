/**
 * OpenTelemetry 分布式追踪服务
 *
 * 企业级分布式追踪实现：
 * - W3C Trace Context 标准
 * - 自动 Span 创建与传播
 * - 自定义属性和事件
 * - 采样策略配置
 * - 多后端导出支持 (Jaeger, Zipkin, OTLP)
 */

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';

// ==================== 类型定义 ====================

export interface SpanContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  traceFlags: number;
  traceState?: string;
}

export interface SpanAttributes {
  [key: string]: string | number | boolean | string[] | number[] | boolean[];
}

export interface SpanEvent {
  name: string;
  timestamp: Date;
  attributes?: SpanAttributes;
}

export enum SpanKind {
  INTERNAL = 'INTERNAL',
  SERVER = 'SERVER',
  CLIENT = 'CLIENT',
  PRODUCER = 'PRODUCER',
  CONSUMER = 'CONSUMER',
}

export enum SpanStatus {
  UNSET = 'UNSET',
  OK = 'OK',
  ERROR = 'ERROR',
}

export interface Span {
  context: SpanContext;
  name: string;
  kind: SpanKind;
  startTime: Date;
  endTime?: Date;
  attributes: SpanAttributes;
  events: SpanEvent[];
  status: SpanStatus;
  statusMessage?: string;
}

export interface TracerConfig {
  serviceName: string;
  serviceVersion: string;
  environment: string;
  enabled: boolean;
  samplingRate: number;
  exporterEndpoint?: string;
  exporterType: 'console' | 'jaeger' | 'zipkin' | 'otlp';
}

// ==================== Span 构建器 ====================

export class SpanBuilder {
  private span: Span;
  private tracer: OpenTelemetryService;

  constructor(
    tracer: OpenTelemetryService,
    name: string,
    parentContext?: SpanContext,
  ) {
    this.tracer = tracer;

    const traceId = parentContext?.traceId || this.generateTraceId();
    const spanId = this.generateSpanId();

    this.span = {
      context: {
        traceId,
        spanId,
        parentSpanId: parentContext?.spanId,
        traceFlags: 1,
      },
      name,
      kind: SpanKind.INTERNAL,
      startTime: new Date(),
      attributes: {},
      events: [],
      status: SpanStatus.UNSET,
    };
  }

  setKind(kind: SpanKind): this {
    this.span.kind = kind;
    return this;
  }

  setAttribute(key: string, value: string | number | boolean): this {
    this.span.attributes[key] = value;
    return this;
  }

  setAttributes(attributes: SpanAttributes): this {
    this.span.attributes = { ...this.span.attributes, ...attributes };
    return this;
  }

  addEvent(name: string, attributes?: SpanAttributes): this {
    this.span.events.push({
      name,
      timestamp: new Date(),
      attributes,
    });
    return this;
  }

  setStatus(status: SpanStatus, message?: string): this {
    this.span.status = status;
    this.span.statusMessage = message;
    return this;
  }

  recordException(error: Error): this {
    this.addEvent('exception', {
      'exception.type': error.name,
      'exception.message': error.message,
      'exception.stacktrace': error.stack || '',
    });
    this.setStatus(SpanStatus.ERROR, error.message);
    return this;
  }

  end(): Span {
    this.span.endTime = new Date();
    this.tracer.recordSpan(this.span);
    return this.span;
  }

  getContext(): SpanContext {
    return this.span.context;
  }

  private generateTraceId(): string {
    return randomUUID().replace(/-/g, '');
  }

  private generateSpanId(): string {
    return randomUUID().replace(/-/g, '').substring(0, 16);
  }
}

// ==================== 服务实现 ====================

@Injectable()
export class OpenTelemetryService implements OnModuleInit, OnModuleDestroy {
  private config: TracerConfig;
  private spans: Map<string, Span[]> = new Map();
  private activeSpans: Map<string, SpanContext> = new Map();
  private flushInterval?: NodeJS.Timeout;
  private readonly logger = console; // 使用 console 避免循环依赖

  constructor(private configService: ConfigService) {
    this.config = this.loadConfig();
  }

  /**
   * 从环境变量加载配置
   *
   * 环境变量说明:
   * - OTEL_ENABLED: 是否启用追踪 (default: true)
   * - OTEL_SERVICE_NAME: 服务名称 (default: ai-agent)
   * - OTEL_SERVICE_VERSION: 服务版本 (default: 1.0.0)
   * - OTEL_EXPORTER_TYPE: 导出器类型 (console|jaeger|zipkin|otlp, default: console)
   * - OTEL_SAMPLING_RATIO: 采样率 (0.0-1.0, default: 1.0)
   * - OTEL_OTLP_ENDPOINT: OTLP 导出端点 (default: http://localhost:4318/v1/traces)
   * - OTEL_JAEGER_ENDPOINT: Jaeger 导出端点 (default: http://localhost:14268/api/traces)
   * - OTEL_ZIPKIN_ENDPOINT: Zipkin 导出端点 (default: http://localhost:9411/api/v2/spans)
   */
  private loadConfig(): TracerConfig {
    const exporterType = this.configService.get(
      'OTEL_EXPORTER_TYPE',
      'console',
    );

    // 根据导出器类型选择端点
    let endpoint: string | undefined;
    switch (exporterType) {
      case 'otlp':
        endpoint = this.configService.get(
          'OTEL_OTLP_ENDPOINT',
          'http://localhost:4318/v1/traces',
        );
        break;
      case 'jaeger':
        endpoint = this.configService.get(
          'OTEL_JAEGER_ENDPOINT',
          'http://localhost:14268/api/traces',
        );
        break;
      case 'zipkin':
        endpoint = this.configService.get(
          'OTEL_ZIPKIN_ENDPOINT',
          'http://localhost:9411/api/v2/spans',
        );
        break;
    }

    return {
      serviceName: this.configService.get('OTEL_SERVICE_NAME', 'ai-agent'),
      serviceVersion: this.configService.get('OTEL_SERVICE_VERSION', '1.0.0'),
      environment: this.configService.get('NODE_ENV', 'development'),
      enabled: this.configService.get('OTEL_ENABLED', 'true') === 'true',
      samplingRate: parseFloat(
        this.configService.get('OTEL_SAMPLING_RATIO', '1.0'),
      ),
      exporterEndpoint: endpoint,
      exporterType,
    };
  }

  onModuleInit(): void {
    if (!this.config.enabled) {
      this.logger.log('[OpenTelemetry] Tracing disabled');
      return;
    }

    this.logger.log(
      `[OpenTelemetry] Initialized with ${this.config.exporterType} exporter`,
    );
    this.logger.log(
      `[OpenTelemetry] Service: ${this.config.serviceName}, Sampling: ${this.config.samplingRate * 100}%`,
    );
    if (this.config.exporterEndpoint) {
      this.logger.log(
        `[OpenTelemetry] Endpoint: ${this.config.exporterEndpoint}`,
      );
    }

    // 定期刷新 spans 到后端
    this.flushInterval = setInterval(() => {
      this.flush();
    }, 10000);
  }

  /**
   * 获取当前配置（用于诊断）
   */
  getConfig(): TracerConfig {
    return { ...this.config };
  }

  /**
   * 检查追踪是否启用
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  onModuleDestroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    this.flush();
  }

  // ==================== 公共 API ====================

  /**
   * 创建新的 Span
   */
  startSpan(name: string, parentContext?: SpanContext): SpanBuilder {
    if (!this.shouldSample()) {
      return new NoOpSpanBuilder(this, name);
    }
    return new SpanBuilder(this, name, parentContext);
  }

  /**
   * 从 W3C Trace Context 头创建 Span
   */
  startSpanFromHeaders(
    name: string,
    headers: Record<string, string | string[] | undefined>,
  ): SpanBuilder {
    const traceparent = this.extractHeader(headers, 'traceparent');
    const parentContext = traceparent
      ? this.parseTraceparent(traceparent)
      : undefined;
    return this.startSpan(name, parentContext);
  }

  /**
   * 创建子 Span
   */
  startChildSpan(name: string, parent: SpanBuilder | SpanContext): SpanBuilder {
    const context = 'getContext' in parent ? parent.getContext() : parent;
    return this.startSpan(name, context);
  }

  /**
   * 设置当前请求的活动 Span
   */
  setActiveSpan(requestId: string, context: SpanContext): void {
    this.activeSpans.set(requestId, context);
  }

  /**
   * 获取当前请求的活动 Span
   */
  getActiveSpan(requestId: string): SpanContext | undefined {
    return this.activeSpans.get(requestId);
  }

  /**
   * 清除当前请求的活动 Span
   */
  clearActiveSpan(requestId: string): void {
    this.activeSpans.delete(requestId);
  }

  /**
   * 记录已完成的 Span
   */
  recordSpan(span: Span): void {
    if (!this.config.enabled) return;

    const traceId = span.context.traceId;
    if (!this.spans.has(traceId)) {
      this.spans.set(traceId, []);
    }
    this.spans.get(traceId)!.push(span);
  }

  /**
   * 获取追踪数据
   */
  getTrace(traceId: string): Span[] {
    return this.spans.get(traceId) || [];
  }

  /**
   * 生成 W3C Traceparent 头
   */
  generateTraceparent(context: SpanContext): string {
    return `00-${context.traceId}-${context.spanId}-${context.traceFlags.toString(16).padStart(2, '0')}`;
  }

  /**
   * 包装异步函数，自动创建 Span
   */
  async trace<T>(
    name: string,
    fn: (span: SpanBuilder) => Promise<T>,
    parentContext?: SpanContext,
  ): Promise<T> {
    const span = this.startSpan(name, parentContext);
    try {
      const result = await fn(span);
      span.setStatus(SpanStatus.OK);
      return result;
    } catch (error) {
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * 包装同步函数，自动创建 Span
   */
  traceSync<T>(
    name: string,
    fn: (span: SpanBuilder) => T,
    parentContext?: SpanContext,
  ): T {
    const span = this.startSpan(name, parentContext);
    try {
      const result = fn(span);
      span.setStatus(SpanStatus.OK);
      return result;
    } catch (error) {
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
    }
  }

  // ==================== Agent 专用方法 ====================

  /**
   * 开始 Agent 请求追踪
   */
  startAgentRequest(
    userId: string,
    conversationId: string,
    message: string,
  ): SpanBuilder {
    return this.startSpan('agent.request')
      .setKind(SpanKind.SERVER)
      .setAttributes({
        'user.id': userId,
        'conversation.id': conversationId,
        'message.length': message.length,
        'service.name': this.config.serviceName,
      });
  }

  /**
   * 追踪 Agent 执行
   */
  traceAgentExecution(
    agentType: string,
    parentContext: SpanContext,
  ): SpanBuilder {
    return this.startSpan(`agent.${agentType}`, parentContext)
      .setKind(SpanKind.INTERNAL)
      .setAttribute('agent.type', agentType);
  }

  /**
   * 追踪 LLM 调用
   */
  traceLLMCall(model: string, parentContext: SpanContext): SpanBuilder {
    return this.startSpan('llm.call', parentContext)
      .setKind(SpanKind.CLIENT)
      .setAttributes({
        'llm.model': model,
        'llm.provider': 'openai',
      });
  }

  /**
   * 追踪工具执行
   */
  traceToolExecution(
    toolName: string,
    parentContext: SpanContext,
  ): SpanBuilder {
    return this.startSpan(`tool.${toolName}`, parentContext)
      .setKind(SpanKind.INTERNAL)
      .setAttribute('tool.name', toolName);
  }

  /**
   * 追踪记忆操作
   */
  traceMemoryOperation(
    operation: string,
    parentContext: SpanContext,
  ): SpanBuilder {
    return this.startSpan(`memory.${operation}`, parentContext)
      .setKind(SpanKind.CLIENT)
      .setAttribute('memory.operation', operation);
  }

  // ==================== 私有方法 ====================

  private shouldSample(): boolean {
    return Math.random() < this.config.samplingRate;
  }

  private extractHeader(
    headers: Record<string, string | string[] | undefined>,
    name: string,
  ): string | undefined {
    const value = headers[name] || headers[name.toLowerCase()];
    return Array.isArray(value) ? value[0] : value;
  }

  private parseTraceparent(traceparent: string): SpanContext | undefined {
    // Format: version-traceId-spanId-traceFlags
    const parts = traceparent.split('-');
    if (parts.length !== 4) return undefined;

    return {
      traceId: parts[1],
      spanId: parts[2],
      traceFlags: parseInt(parts[3], 16),
    };
  }

  private flush(): void {
    if (this.spans.size === 0) return;

    const allSpans = Array.from(this.spans.values()).flat();

    switch (this.config.exporterType) {
      case 'console':
        this.exportToConsole(allSpans);
        break;
      case 'jaeger':
      case 'zipkin':
      case 'otlp':
        this.exportToBackend(allSpans);
        break;
    }

    // 清理已导出的 spans (保留最近5分钟)
    const cutoff = Date.now() - 5 * 60 * 1000;
    for (const [traceId, spans] of this.spans) {
      const recent = spans.filter(
        (s) => s.endTime && s.endTime.getTime() > cutoff,
      );
      if (recent.length === 0) {
        this.spans.delete(traceId);
      } else {
        this.spans.set(traceId, recent);
      }
    }
  }

  private exportToConsole(spans: Span[]): void {
    for (const span of spans) {
      const duration = span.endTime
        ? span.endTime.getTime() - span.startTime.getTime()
        : 0;

      console.log(
        JSON.stringify({
          type: 'span',
          traceId: span.context.traceId,
          spanId: span.context.spanId,
          parentSpanId: span.context.parentSpanId,
          name: span.name,
          kind: span.kind,
          status: span.status,
          durationMs: duration,
          attributes: span.attributes,
          events: span.events.length,
        }),
      );
    }
  }

  private async exportToBackend(spans: Span[]): Promise<void> {
    if (!this.config.exporterEndpoint) {
      this.logger.warn(
        '[OpenTelemetry] No endpoint configured, skipping export',
      );
      return;
    }

    try {
      const body = this.formatSpansForExporter(spans);
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      const response = await fetch(this.config.exporterEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        this.logger.error(
          `[OpenTelemetry] Export failed: ${response.status} ${response.statusText}`,
        );
      }
    } catch (error) {
      this.logger.error('[OpenTelemetry] Failed to export spans', error);
    }
  }

  /**
   * 根据导出器类型格式化 spans
   */
  private formatSpansForExporter(spans: Span[]): unknown {
    switch (this.config.exporterType) {
      case 'zipkin':
        return this.toZipkinFormat(spans);
      case 'jaeger':
        return this.toJaegerFormat(spans);
      case 'otlp':
      default:
        return this.toOTLPFormat(spans);
    }
  }

  /**
   * OTLP 格式
   */
  private toOTLPFormat(spans: Span[]): unknown {
    return {
      resourceSpans: [
        {
          resource: {
            attributes: [
              {
                key: 'service.name',
                value: { stringValue: this.config.serviceName },
              },
              {
                key: 'service.version',
                value: { stringValue: this.config.serviceVersion },
              },
              {
                key: 'deployment.environment',
                value: { stringValue: this.config.environment },
              },
            ],
          },
          scopeSpans: [
            {
              spans: spans.map((s) => this.toOTLPSpan(s)),
            },
          ],
        },
      ],
    };
  }

  /**
   * Zipkin 格式
   */
  private toZipkinFormat(spans: Span[]): unknown[] {
    return spans.map((span) => ({
      traceId: span.context.traceId,
      id: span.context.spanId,
      parentId: span.context.parentSpanId,
      name: span.name,
      timestamp: span.startTime.getTime() * 1000, // 微秒
      duration: span.endTime
        ? (span.endTime.getTime() - span.startTime.getTime()) * 1000
        : 0,
      localEndpoint: {
        serviceName: this.config.serviceName,
      },
      tags: Object.fromEntries(
        Object.entries(span.attributes).map(([k, v]) => [k, String(v)]),
      ),
      annotations: span.events.map((e) => ({
        timestamp: e.timestamp.getTime() * 1000,
        value: e.name,
      })),
    }));
  }

  /**
   * Jaeger 格式 (Thrift over HTTP)
   */
  private toJaegerFormat(spans: Span[]): unknown {
    return {
      process: {
        serviceName: this.config.serviceName,
        tags: [
          {
            key: 'service.version',
            vType: 'STRING',
            vStr: this.config.serviceVersion,
          },
          {
            key: 'deployment.environment',
            vType: 'STRING',
            vStr: this.config.environment,
          },
        ],
      },
      spans: spans.map((span) => ({
        traceIdLow: BigInt('0x' + span.context.traceId.slice(16)),
        traceIdHigh: BigInt('0x' + span.context.traceId.slice(0, 16)),
        spanId: BigInt('0x' + span.context.spanId),
        parentSpanId: span.context.parentSpanId
          ? BigInt('0x' + span.context.parentSpanId)
          : BigInt(0),
        operationName: span.name,
        startTime: span.startTime.getTime() * 1000,
        duration: span.endTime
          ? (span.endTime.getTime() - span.startTime.getTime()) * 1000
          : 0,
        tags: Object.entries(span.attributes).map(([k, v]) => ({
          key: k,
          vType:
            typeof v === 'number'
              ? 'LONG'
              : typeof v === 'boolean'
                ? 'BOOL'
                : 'STRING',
          [typeof v === 'number'
            ? 'vLong'
            : typeof v === 'boolean'
              ? 'vBool'
              : 'vStr']: v,
        })),
        logs: span.events.map((e) => ({
          timestamp: e.timestamp.getTime() * 1000,
          fields: [{ key: 'event', vType: 'STRING', vStr: e.name }],
        })),
      })),
    };
  }

  private toOTLPSpan(span: Span): Record<string, unknown> {
    return {
      traceId: span.context.traceId,
      spanId: span.context.spanId,
      parentSpanId: span.context.parentSpanId,
      name: span.name,
      kind: this.toOTLPSpanKind(span.kind),
      startTimeUnixNano: span.startTime.getTime() * 1000000,
      endTimeUnixNano: span.endTime ? span.endTime.getTime() * 1000000 : 0,
      attributes: Object.entries(span.attributes).map(([k, v]) => ({
        key: k,
        value: this.toOTLPValue(v),
      })),
      status: {
        code:
          span.status === SpanStatus.ERROR
            ? 2
            : span.status === SpanStatus.OK
              ? 1
              : 0,
        message: span.statusMessage,
      },
    };
  }

  private toOTLPSpanKind(kind: SpanKind): number {
    const map: Record<SpanKind, number> = {
      [SpanKind.INTERNAL]: 1,
      [SpanKind.SERVER]: 2,
      [SpanKind.CLIENT]: 3,
      [SpanKind.PRODUCER]: 4,
      [SpanKind.CONSUMER]: 5,
    };
    return map[kind];
  }

  private toOTLPValue(
    value: string | number | boolean | string[] | number[] | boolean[],
  ): Record<string, unknown> {
    if (typeof value === 'string') return { stringValue: value };
    if (typeof value === 'number')
      return Number.isInteger(value)
        ? { intValue: value }
        : { doubleValue: value };
    if (typeof value === 'boolean') return { boolValue: value };
    if (Array.isArray(value))
      return {
        arrayValue: {
          values: value.map((v) => this.toOTLPValue(v)),
        },
      };
    return { stringValue: String(value) };
  }
}

// ==================== NoOp 实现（未采样时使用）====================

class NoOpSpanBuilder extends SpanBuilder {
  constructor(tracer: OpenTelemetryService, name: string) {
    super(tracer, name);
  }

  end(): Span {
    // NoOp - 不记录
    return {} as Span;
  }
}
