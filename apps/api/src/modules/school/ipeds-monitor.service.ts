import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

/**
 * IPEDS 更新监控服务
 * 
 * 定期检查 IPEDS 是否有新数据发布
 * 有更新时发送通知
 */
@Injectable()
export class IpedsMonitorService {
  private readonly logger = new Logger(IpedsMonitorService.name);
  private readonly IPEDS_DATA_PAGE = 'https://nces.ed.gov/ipeds/datacenter/DataFiles.aspx';
  
  // 记录上次检查的数据版本
  private lastKnownVersion: string | null = null;

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
    const fingerprint = html.length.toString() + '_' + 
      patterns.filter(p => html.includes(p)).join(',');

    if (this.lastKnownVersion && fingerprint !== this.lastKnownVersion) {
      this.lastKnownVersion = fingerprint;
      return true;
    }

    this.lastKnownVersion = fingerprint;
    return false;
  }

  private async sendNotification() {
    // 发送通知 (可集成邮件/Slack/微信等)
    this.logger.log(`
╔════════════════════════════════════════════════════════════╗
║  📊 IPEDS 新数据提醒                                        ║
║                                                             ║
║  检测到 IPEDS 可能有新数据发布                                ║
║  请访问以下链接下载最新数据:                                   ║
║                                                             ║
║  ${this.IPEDS_DATA_PAGE}                                    ║
║                                                             ║
║  建议下载:                                                   ║
║  - ADM (Admissions) - 录取数据                               ║
║  - EF (Enrollment) - 国际生数据                              ║
║  - IC (Institutional Characteristics) - 学校特征             ║
╚════════════════════════════════════════════════════════════╝
    `);

    // TODO: 实际发送邮件
    // await this.emailService.send({
    //   to: 'admin@example.com',
    //   subject: 'IPEDS 新数据提醒',
    //   body: '...'
    // });
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




