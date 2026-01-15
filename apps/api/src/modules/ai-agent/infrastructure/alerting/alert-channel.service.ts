/**
 * 告警通道服务
 *
 * 功能：
 * - 多渠道告警支持（Slack、邮件、企业微信）
 * - 告警等级分类（CRITICAL、WARNING、INFO）
 * - 告警聚合与去重
 * - 与 AuditService 集成
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../../../common/redis/redis.service';

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
export class AlertChannelService implements OnModuleInit {
  private readonly logger = new Logger(AlertChannelService.name);
  private config: AlertConfig;
  private alertBuffer: Map<string, AggregatedAlert> = new Map();
  private alertCountPerMinute = 0;
  private lastMinuteReset = Date.now();

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

  async onModuleInit() {
    this.logger.log('AlertChannelService initialized');

    // 定期刷新聚合告警
    setInterval(() => this.flushAggregatedAlerts(), 30000);

    // 重置每分钟告警计数
    setInterval(() => {
      this.alertCountPerMinute = 0;
      this.lastMinuteReset = Date.now();
    }, 60000);
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
   * 发送到指定渠道
   */
  private async sendToChannel(
    channel: AlertChannel,
    payload: AlertPayload,
  ): Promise<void> {
    try {
      switch (channel) {
        case AlertChannel.SLACK:
          await this.sendToSlack(payload);
          break;
        case AlertChannel.EMAIL:
          await this.sendToEmail(payload);
          break;
        case AlertChannel.WECHAT:
          await this.sendToWechat(payload);
          break;
        case AlertChannel.DINGTALK:
          await this.sendToDingtalk(payload);
          break;
        case AlertChannel.REDIS_QUEUE:
          await this.sendToRedisQueue(payload);
          break;
      }
    } catch (error) {
      this.logger.error(`Failed to send alert to ${channel}`, error);
    }
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

    return channels;
  }
}
