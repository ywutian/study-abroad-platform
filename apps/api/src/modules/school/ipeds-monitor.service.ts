import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EmailService } from '../../common/email/email.service';
import { SettingsService, SETTING_KEYS } from '../settings/settings.module';

/**
 * IPEDS 更新监控服务
 *
 * 定期检查 IPEDS 是否有新数据发布
 * 有更新时发送通知
 */
@Injectable()
export class IpedsMonitorService {
  private readonly logger = new Logger(IpedsMonitorService.name);
  private readonly IPEDS_DATA_PAGE =
    'https://nces.ed.gov/ipeds/datacenter/DataFiles.aspx';

  // 记录上次检查的数据版本
  private lastKnownVersion: string | null = null;

  constructor(
    private emailService: EmailService,
    private settingsService: SettingsService,
  ) {}

  /**
   * 每周一检查 IPEDS 更新
   */
  @Cron('0 9 * * 1') // 每周一上午 9 点
  async checkForUpdates() {
    this.logger.log('🔍 检查 IPEDS 数据更新...');

    try {
      // 简单方案: 检查页面是否有变化
      // 生产环境可以解析页面内容，提取最新数据文件列表

      const response = await fetch(this.IPEDS_DATA_PAGE);
      const html = await response.text();

      // 提取关键信息 (简化版)
      const hasNewData = this.detectNewData(html);

      if (hasNewData) {
        this.logger.warn('📢 检测到 IPEDS 新数据发布！');
        await this.sendNotification();
      } else {
        this.logger.log('✅ IPEDS 数据无更新');
      }
    } catch (error) {
      this.logger.error('检查 IPEDS 更新失败', error);
    }
  }

  private detectNewData(html: string): boolean {
    // 简单检测: 查找页面中的年份标识
    // 实际生产中应该解析具体的文件列表

    const currentYear = new Date().getFullYear();
    const patterns = [
      `${currentYear}`,
      `${currentYear - 1}`,
      'Provisional',
      'Final Release',
    ];

    // 生成简单的页面指纹
    const fingerprint =
      html.length.toString() +
      '_' +
      patterns.filter((p) => html.includes(p)).join(',');

    if (this.lastKnownVersion && fingerprint !== this.lastKnownVersion) {
      this.lastKnownVersion = fingerprint;
      return true;
    }

    this.lastKnownVersion = fingerprint;
    return false;
  }

  private async sendNotification() {
    // 检查是否启用通知
    const notificationEnabled = await this.settingsService.getTyped(
      SETTING_KEYS.NOTIFICATION_ENABLED,
      true,
    );
    if (!notificationEnabled) {
      this.logger.log('邮件通知已禁用，跳过发送');
      return;
    }

    // 从后台设置获取管理员邮箱
    const adminEmail = await this.settingsService.get(SETTING_KEYS.ADMIN_EMAIL);
    if (!adminEmail) {
      this.logger.warn('未设置管理员邮箱，无法发送 IPEDS 更新通知');
      return;
    }

    this.logger.log('📢 检测到 IPEDS 新数据，发送通知邮件...');
    const year = new Date().getFullYear();

    await this.emailService.sendEmail({
      to: adminEmail,
      subject: '📊 IPEDS 新数据发布提醒',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { text-align: center; padding: 20px 0; border-bottom: 2px solid #3b82f6; }
            .content { padding: 30px 0; }
            .button { display: inline-block; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; }
            .footer { text-align: center; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 12px; }
            .data-list { background: #f8fafc; padding: 15px 20px; border-radius: 8px; margin: 20px 0; }
            .data-item { margin: 8px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="color: #3b82f6; margin: 0;">📊 IPEDS 数据更新</h1>
            </div>
            <div class="content">
              <p>检测到 IPEDS (Integrated Postsecondary Education Data System) 可能有新数据发布。</p>
              
              <div class="data-list">
                <strong>建议下载的数据文件：</strong>
                <div class="data-item">📋 <strong>ADM</strong> - 录取数据（录取率、申请人数）</div>
                <div class="data-item">👥 <strong>EF</strong> - 入学数据（国际生比例）</div>
                <div class="data-item">🏫 <strong>IC</strong> - 院校特征（学费、地址）</div>
              </div>

              <p style="text-align: center; margin: 30px 0;">
                <a href="${this.IPEDS_DATA_PAGE}" class="button">访问 IPEDS 数据中心</a>
              </p>

              <p style="color: #666; font-size: 14px;">
                直接下载链接：<br>
                • <a href="https://nces.ed.gov/ipeds/datacenter/data/ADM${year}.zip">ADM${year}.zip</a><br>
                • <a href="https://nces.ed.gov/ipeds/datacenter/data/EF${year}A.zip">EF${year}A.zip</a><br>
                • <a href="https://nces.ed.gov/ipeds/datacenter/data/IC${year}.zip">IC${year}.zip</a>
              </p>
            </div>
            <div class="footer">
              <p>此邮件由系统自动发送 - 留学申请平台</p>
              <p>检测时间：${new Date().toLocaleString('zh-CN')}</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    this.logger.log(`✅ IPEDS 更新通知已发送至 ${adminEmail}`);
  }

  /**
   * 获取 IPEDS 数据下载链接
   */
  getDownloadLinks() {
    const year = new Date().getFullYear();
    return {
      dataCenter: 'https://nces.ed.gov/ipeds/datacenter/DataFiles.aspx',
      directLinks: {
        admissions: `https://nces.ed.gov/ipeds/datacenter/data/ADM${year}.zip`,
        enrollment: `https://nces.ed.gov/ipeds/datacenter/data/EF${year}A.zip`,
        institutional: `https://nces.ed.gov/ipeds/datacenter/data/IC${year}.zip`,
      },
      documentation: 'https://nces.ed.gov/ipeds/use-the-data',
    };
  }
}
