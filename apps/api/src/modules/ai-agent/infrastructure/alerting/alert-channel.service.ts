/**
 * 告警通道服务
 *
 * 功能：
 * - 多渠道告警支持（Slack、邮件、企业微信）
 * - 告警等级分类（CRITICAL、WARNING、INFO）
 * - 告警聚合与去重
 * - 与 AuditService 集成
 */

import {
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../../../common/redis/redis.service';
import { REDIS_TTL } from '../../../../common/redis/redis-ttl.constants';

export enum AlertSeverity {
  CRITICAL = 'critical',
  WARNING = 'warning',
  INFO = 'info',
}

export enum AlertChannel {
  SLACK = 'slack',
  EMAIL = 'email',
  WECHAT = 'wechat',
  DINGTALK = 'dingtalk',
  PAGERDUTY = 'pagerduty',
  REDIS_QUEUE = 'redis_queue',
}

export interface AlertPayload {
  /** 告警 ID（用于去重） */
  alertId?: string;
  /** 告警标题 */
  title: string;
  /** 告警详情 */
  message: string;
  /** 严重级别 */
  severity: AlertSeverity;
  /** 来源服务 */
  source?: string;
  /** 用户 ID（可选） */
  userId?: string;
  /** 追踪 ID */
  traceId?: string;
  /** 额外数据 */
  metadata?: Record<string, any>;
  /** 时间戳 */
  timestamp?: Date;
}

interface AlertConfig {
  /** Slack Webhook URL */
  slackWebhook?: string;
  /** 邮件是否启用 */
  emailEnabled: boolean;
  /** 邮件收件人 */
  emailRecipients?: string[];
  /** 企业微信 Webhook URL */
  wechatWebhook?: string;
  /** 钉钉 Webhook URL */
  dingtalkWebhook?: string;
  /** PagerDuty Events API v2 routing key */
  pagerdutyRoutingKey?: string;
  /** 告警聚合窗口（秒） */
  aggregationWindow: number;
  /** 最大告警频率（每分钟） */
  maxAlertsPerMinute: number;
}

interface AggregatedAlert {
  count: number;
  firstSeen: Date;
  lastSeen: Date;
  payload: AlertPayload;
}

@Injectable()
export class AlertChannelService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AlertChannelService.name);
  private config: AlertConfig;
  private alertBuffer: Map<string, AggregatedAlert> = new Map();
  private alertCountPerMinute = 0;
  private lastMinuteReset = Date.now();
  private flushInterval?: ReturnType<typeof setInterval>;
  private resetInterval?: ReturnType<typeof setInterval>;

  constructor(
    private configService: ConfigService,
    private redis: RedisService,
  ) {
    this.config = {
      slackWebhook: this.configService.get('ALERT_SLACK_WEBHOOK'),
      emailEnabled: this.configService.get('ALERT_EMAIL_ENABLED') === 'true',
      emailRecipients: this.configService
        .get('ALERT_EMAIL_RECIPIENTS', '')
        .split(',')
        .filter(Boolean),
      wechatWebhook: this.configService.get('ALERT_WECHAT_WEBHOOK'),
      dingtalkWebhook: this.configService.get('ALERT_DINGTALK_WEBHOOK'),
      pagerdutyRoutingKey: this.configService.get(
        'ALERT_PAGERDUTY_ROUTING_KEY',
      ),
      aggregationWindow: parseInt(
        this.configService.get('ALERT_AGGREGATION_WINDOW', '60'),
        10,
      ),
      maxAlertsPerMinute: parseInt(
        this.configService.get('ALERT_MAX_PER_MINUTE', '30'),
        10,
      ),
    };
  }

  onModuleInit() {
    this.logger.log('AlertChannelService initialized');

    // 定期刷新聚合告警
    this.flushInterval = setInterval(() => this.flushAggregatedAlerts(), 30000);

    // 重置每分钟告警计数
    this.resetInterval = setInterval(() => {
      this.alertCountPerMinute = 0;
      this.lastMinuteReset = Date.now();
    }, 60000);
  }

  onModuleDestroy() {
    if (this.flushInterval) clearInterval(this.flushInterval);
    if (this.resetInterval) clearInterval(this.resetInterval);
  }

  /**
   * 发送告警
   */
  async send(payload: AlertPayload): Promise<void> {
    // 生成告警 ID（用于去重）
    const alertId =
      payload.alertId ||
      this.generateAlertId(payload.title, payload.source || '');

    // 检查限流
    if (this.isRateLimited()) {
      this.logger.warn('Alert rate limit exceeded, dropping alert', {
        alertId,
      });
      return;
    }

    // 聚合相同告警
    const existing = this.alertBuffer.get(alertId);
    if (existing) {
      existing.count++;
      existing.lastSeen = new Date();
      this.alertBuffer.set(alertId, existing);
      return;
    }

    // 新告警
    this.alertBuffer.set(alertId, {
      count: 1,
      firstSeen: new Date(),
      lastSeen: new Date(),
      payload: { ...payload, timestamp: payload.timestamp || new Date() },
    });

    // CRITICAL 告警立即发送
    if (payload.severity === AlertSeverity.CRITICAL) {
      await this.sendImmediate(payload);
    }

    this.alertCountPerMinute++;
  }

  /**
   * 立即发送告警（不聚合）
   */
  async sendImmediate(payload: AlertPayload): Promise<void> {
    const channels = this.getChannelsForSeverity(payload.severity);

    await Promise.allSettled(
      channels.map((channel) => this.sendToChannel(channel, payload)),
    );
  }

  /**
   * 发送到指定渠道（含投递日志记录）
   */
  private async sendToChannel(
    channel: AlertChannel,
    payload: AlertPayload,
  ): Promise<void> {
    const alertId =
      payload.alertId ||
      this.generateAlertId(payload.title, payload.source || '');
    const startTime = Date.now();

    try {
      switch (channel) {
        case AlertChannel.SLACK:
          await this.sendWithRetry(() => this.sendToSlack(payload));
          break;
        case AlertChannel.EMAIL:
          await this.sendToEmail(payload);
          break;
        case AlertChannel.WECHAT:
          await this.sendWithRetry(() => this.sendToWechat(payload));
          break;
        case AlertChannel.DINGTALK:
          await this.sendWithRetry(() => this.sendToDingtalk(payload));
          break;
        case AlertChannel.PAGERDUTY:
          await this.sendWithRetry(() => this.sendToPagerDuty(payload));
          break;
        case AlertChannel.REDIS_QUEUE:
          await this.sendToRedisQueue(payload);
          break;
      }

      // 投递成功日志
      await this.recordDelivery(
        alertId,
        channel,
        'success',
        Date.now() - startTime,
      );
    } catch (error) {
      this.logger.error(`Failed to send alert to ${channel}`, error);

      // 投递失败日志
      await this.recordDelivery(
        alertId,
        channel,
        'failed',
        Date.now() - startTime,
        error instanceof Error ? error.message : String(error),
      );

      // 记录失败到 Redis 队列供后续审计
      await this.redis
        .lpush(
          'alerts:failed',
          JSON.stringify({
            alertId,
            channel,
            error: error instanceof Error ? error.message : String(error),
            payload: { title: payload.title, severity: payload.severity },
            timestamp: new Date().toISOString(),
          }),
        )
        .catch(() => {});
    }
  }

  /**
   * Webhook 重试（指数退避，最多 3 次）
   */
  private async sendWithRetry(
    fn: () => Promise<void>,
    maxRetries = 3,
    baseDelayMs = 1000,
  ): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        await fn();
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < maxRetries - 1) {
          const delay = baseDelayMs * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  /**
   * 发送到 Slack
   */
  private async sendToSlack(payload: AlertPayload): Promise<void> {
    if (!this.config.slackWebhook) return;

    const color = this.getSeverityColor(payload.severity);
    const slackPayload = {
      attachments: [
        {
          color,
          title: `[${payload.severity.toUpperCase()}] ${payload.title}`,
          text: payload.message,
          fields: [
            {
              title: 'Source',
              value: payload.source || 'AI Agent',
              short: true,
            },
            {
              title: 'Time',
              value: (payload.timestamp || new Date()).toISOString(),
              short: true,
            },
            ...(payload.userId
              ? [{ title: 'User ID', value: payload.userId, short: true }]
              : []),
            ...(payload.traceId
              ? [{ title: 'Trace ID', value: payload.traceId, short: true }]
              : []),
          ],
        },
      ],
    };

    await fetch(this.config.slackWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slackPayload),
    });
  }

  /**
   * 发送到邮件（通过 Redis 队列，由 EmailService 处理）
   */
  private async sendToEmail(payload: AlertPayload): Promise<void> {
    if (!this.config.emailEnabled || !this.config.emailRecipients?.length)
      return;

    await this.redis.lpush(
      'email:alerts',
      JSON.stringify({
        to: this.config.emailRecipients,
        subject: `[${payload.severity.toUpperCase()}] ${payload.title}`,
        body: this.formatEmailBody(payload),
        timestamp: new Date().toISOString(),
      }),
    );
  }

  /**
   * 发送到企业微信
   */
  private async sendToWechat(payload: AlertPayload): Promise<void> {
    if (!this.config.wechatWebhook) return;

    const wechatPayload = {
      msgtype: 'markdown',
      markdown: {
        content: `### ${this.getSeverityEmoji(payload.severity)} ${payload.title}
> **级别**: ${payload.severity.toUpperCase()}
> **来源**: ${payload.source || 'AI Agent'}
> **时间**: ${(payload.timestamp || new Date()).toLocaleString('zh-CN')}

${payload.message}${payload.traceId ? `\n\n**Trace ID**: ${payload.traceId}` : ''}`,
      },
    };

    await fetch(this.config.wechatWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(wechatPayload),
    });
  }

  /**
   * 发送到钉钉
   */
  private async sendToDingtalk(payload: AlertPayload): Promise<void> {
    if (!this.config.dingtalkWebhook) return;

    const dingtalkPayload = {
      msgtype: 'markdown',
      markdown: {
        title: `[${payload.severity.toUpperCase()}] ${payload.title}`,
        text: `### ${this.getSeverityEmoji(payload.severity)} ${payload.title}
- **级别**: ${payload.severity.toUpperCase()}
- **来源**: ${payload.source || 'AI Agent'}
- **时间**: ${(payload.timestamp || new Date()).toLocaleString('zh-CN')}

${payload.message}${payload.traceId ? `\n\n**Trace ID**: ${payload.traceId}` : ''}`,
      },
    };

    await fetch(this.config.dingtalkWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dingtalkPayload),
    });
  }

  /**
   * 发送到 PagerDuty（Events API v2）
   */
  private async sendToPagerDuty(payload: AlertPayload): Promise<void> {
    if (!this.config.pagerdutyRoutingKey) return;

    const severityMap: Record<string, string> = {
      [AlertSeverity.CRITICAL]: 'critical',
      [AlertSeverity.WARNING]: 'warning',
      [AlertSeverity.INFO]: 'info',
    };

    const pdPayload = {
      routing_key: this.config.pagerdutyRoutingKey,
      event_action: 'trigger',
      payload: {
        summary: `[${payload.severity.toUpperCase()}] ${payload.title}: ${payload.message.slice(0, 200)}`,
        severity: severityMap[payload.severity] || 'warning',
        source: payload.source || 'study-abroad-platform',
        component: 'ai-agent',
        group: 'security',
        class: payload.metadata?.eventType || 'alert',
        timestamp: (payload.timestamp || new Date()).toISOString(),
        custom_details: {
          title: payload.title,
          message: payload.message,
          userId: payload.userId,
          traceId: payload.traceId,
          ...payload.metadata,
        },
      },
    };

    const response = await fetch('https://events.pagerduty.com/v2/enqueue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pdPayload),
    });

    if (!response.ok) {
      throw new InternalServerErrorException(
        `PagerDuty API error: ${response.status} ${response.statusText}`,
      );
    }
  }

  /**
   * 发送到 Redis 队列（供其他服务消费）
   */
  private async sendToRedisQueue(payload: AlertPayload): Promise<void> {
    await this.redis.lpush(
      'alerts:queue',
      JSON.stringify({
        ...payload,
        timestamp: (payload.timestamp || new Date()).toISOString(),
      }),
    );
  }

  /**
   * 刷新聚合告警
   */
  private async flushAggregatedAlerts(): Promise<void> {
    const now = Date.now();
    const windowMs = this.config.aggregationWindow * 1000;

    for (const [alertId, aggregated] of this.alertBuffer.entries()) {
      const age = now - aggregated.firstSeen.getTime();

      // 超过聚合窗口则发送
      if (age >= windowMs) {
        const payload = aggregated.payload;

        // 修改消息以显示聚合数量
        if (aggregated.count > 1) {
          payload.message = `[Aggregated: ${aggregated.count} occurrences]\n${payload.message}`;
        }

        await this.sendImmediate(payload);
        this.alertBuffer.delete(alertId);
      }
    }
  }

  /**
   * 根据严重级别获取渠道
   */
  private getChannelsForSeverity(severity: AlertSeverity): AlertChannel[] {
    const channels: AlertChannel[] = [AlertChannel.REDIS_QUEUE];

    switch (severity) {
      case AlertSeverity.CRITICAL:
        // CRITICAL: 所有渠道
        if (this.config.slackWebhook) channels.push(AlertChannel.SLACK);
        if (this.config.emailEnabled) channels.push(AlertChannel.EMAIL);
        if (this.config.wechatWebhook) channels.push(AlertChannel.WECHAT);
        if (this.config.dingtalkWebhook) channels.push(AlertChannel.DINGTALK);
        if (this.config.pagerdutyRoutingKey)
          channels.push(AlertChannel.PAGERDUTY);
        break;
      case AlertSeverity.WARNING:
        // WARNING: Slack + Redis
        if (this.config.slackWebhook) channels.push(AlertChannel.SLACK);
        break;
      case AlertSeverity.INFO:
        // INFO: 仅 Redis
        break;
    }

    return channels;
  }

  /**
   * 检查是否被限流
   */
  private isRateLimited(): boolean {
    return this.alertCountPerMinute >= this.config.maxAlertsPerMinute;
  }

  /**
   * 生成告警 ID（用于去重）
   */
  private generateAlertId(title: string, source: string): string {
    return `${source}:${title}`.toLowerCase().replace(/\s+/g, '_');
  }

  /**
   * 获取严重级别对应的颜色
   */
  private getSeverityColor(severity: AlertSeverity): string {
    switch (severity) {
      case AlertSeverity.CRITICAL:
        return '#dc3545'; // 红色
      case AlertSeverity.WARNING:
        return '#ffc107'; // 黄色
      case AlertSeverity.INFO:
        return '#17a2b8'; // 蓝色
      default:
        return '#6c757d'; // 灰色
    }
  }

  /**
   * 获取严重级别对应的 Emoji
   */
  private getSeverityEmoji(severity: AlertSeverity): string {
    switch (severity) {
      case AlertSeverity.CRITICAL:
        return '🔴';
      case AlertSeverity.WARNING:
        return '🟡';
      case AlertSeverity.INFO:
        return '🔵';
      default:
        return '⚪';
    }
  }

  /**
   * 格式化邮件正文
   */
  private formatEmailBody(payload: AlertPayload): string {
    return `
Alert Details
=============

Title: ${payload.title}
Severity: ${payload.severity.toUpperCase()}
Source: ${payload.source || 'AI Agent'}
Time: ${(payload.timestamp || new Date()).toISOString()}
${payload.userId ? `User ID: ${payload.userId}` : ''}
${payload.traceId ? `Trace ID: ${payload.traceId}` : ''}

Message:
--------
${payload.message}

${payload.metadata ? `\nMetadata:\n${JSON.stringify(payload.metadata, null, 2)}` : ''}
    `.trim();
  }

  /**
   * 获取告警统计
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async getStats(): Promise<{
    pendingAlerts: number;
    alertsPerMinute: number;
    configuredChannels: string[];
  }> {
    return {
      pendingAlerts: this.alertBuffer.size,
      alertsPerMinute: this.alertCountPerMinute,
      configuredChannels: this.getConfiguredChannels(),
    };
  }

  /**
   * 获取已配置的渠道列表
   */
  private getConfiguredChannels(): string[] {
    const channels: string[] = ['redis_queue'];

    if (this.config.slackWebhook) channels.push('slack');
    if (this.config.emailEnabled) channels.push('email');
    if (this.config.wechatWebhook) channels.push('wechat');
    if (this.config.dingtalkWebhook) channels.push('dingtalk');
    if (this.config.pagerdutyRoutingKey) channels.push('pagerduty');

    return channels;
  }

  // ==================== 投递日志 ====================

  /**
   * 记录告警投递结果（Redis hash，TTL 7 天）
   */
  private async recordDelivery(
    alertId: string,
    channel: string,
    status: 'success' | 'failed',
    durationMs: number,
    error?: string,
  ): Promise<void> {
    try {
      const key = `alert:delivery:${alertId}`;
      // 使用 list 存储投递日志（RedisService 不暴露 hset）
      await this.redis.lpush(
        key,
        JSON.stringify({
          channel,
          status,
          durationMs,
          error,
          timestamp: new Date().toISOString(),
        }),
      );
      await this.redis.expire(key, REDIS_TTL.ALERT_DATA);
    } catch {
      // 不因日志记录失败影响告警发送
    }
  }

  /**
   * 获取告警投递日志
   */
  async getDeliveryLog(alertId: string): Promise<Record<string, any>[]> {
    const key = `alert:delivery:${alertId}`;
    const entries = await this.redis.lrange(key, 0, -1);

    if (!entries || entries.length === 0) return [];

    return entries.map((v) => {
      try {
        // @cache-parse-allowed - Record<string, any>[]; the type claims nothing
        return JSON.parse(v);
      } catch {
        return { raw: v };
      }
    });
  }

  // ==================== 告警确认 ====================

  /**
   * 确认（acknowledge）一个告警
   */
  async acknowledgeAlert(
    alertId: string,
    acknowledgedBy: string,
    notes?: string,
  ): Promise<void> {
    const key = `alert:ack:${alertId}`;
    await this.redis.set(
      key,
      JSON.stringify({
        acknowledgedBy,
        acknowledgedAt: new Date().toISOString(),
        notes,
      }),
      REDIS_TTL.ALERT_ARCHIVE,
    );

    // 如果配置了 PagerDuty，发送 resolve 事件
    if (this.config.pagerdutyRoutingKey) {
      try {
        await fetch('https://events.pagerduty.com/v2/enqueue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            routing_key: this.config.pagerdutyRoutingKey,
            event_action: 'resolve',
            dedup_key: alertId,
          }),
        });
      } catch (err) {
        this.logger.error('Failed to resolve PagerDuty alert', err);
      }
    }
  }

  /**
   * 获取未确认的活跃告警列表
   */
  async getActiveAlerts(limit = 50): Promise<any[]> {
    const raw = await this.redis.lrange('alerts:queue', 0, limit - 1);

    if (!raw || raw.length === 0) return [];

    const alerts: any[] = [];
    for (const item of raw) {
      try {
        const alert = JSON.parse(item);
        const ackKey = `alert:ack:${alert.alertId || this.generateAlertId(alert.title, alert.source || '')}`;
        const ack = await this.redis.get(ackKey);
        if (!ack) {
          alerts.push(alert);
        }
      } catch {
        // skip malformed entries
      }
    }

    return alerts;
  }
}
