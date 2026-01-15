import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../common/redis/redis.service';
import * as crypto from 'crypto';

/**
 * 消息内容过滤服务
 *
 * 功能：
 * 1. 敏感词过滤 — 基于内存词库，命中后替换为 ***
 * 2. 频率限制 — 每用户每分钟最多 30 条（Redis 计数器）
 * 3. 重复内容检测 — 5 分钟内同一用户不能发超过 3 条相同内容
 *
 * 无 Redis 时降级为仅敏感词过滤（内存模式）
 */
@Injectable()
export class MessageFilterService {
  private readonly logger = new Logger(MessageFilterService.name);

  // 敏感词集合（小写存储，匹配时不区分大小写）
  private sensitiveWords: string[] = [];

  // 频率限制配置
  private readonly RATE_LIMIT = 30; // 每分钟最大消息数
  private readonly RATE_WINDOW = 60; // 窗口秒数
  private readonly REPEAT_LIMIT = 3; // 重复内容上限
  private readonly REPEAT_WINDOW = 300; // 重复检测窗口秒数

  constructor(private readonly redis: RedisService) {
    this.loadSensitiveWords();
  }

  /**
   * 加载敏感词库
   * 可后续扩展为从数据库/配置文件加载
   */
  private loadSensitiveWords() {
    // 基础敏感词（中英文混合），生产环境应从配置或数据库加载
    this.sensitiveWords = [
      // 辱骂类
      'fuck',
      'shit',
      'bitch',
      'asshole',
      '傻逼',
      '操你妈',
      '去死',
      '废物',
      '垃圾',
      // 诈骗类
      '代写',
      '包过',
      '保录',
      '花钱买',
      '中介费',
      // 可以在这里扩展更多
    ];
    this.logger.log(`Loaded ${this.sensitiveWords.length} sensitive words`);
  }

  /**
   * 过滤消息内容（敏感词替换）
   */
  filterContent(content: string): { clean: boolean; filtered: string } {
    let filtered = content;
    let clean = true;

    for (const word of this.sensitiveWords) {
      const regex = new RegExp(this.escapeRegex(word), 'gi');
      if (regex.test(filtered)) {
        clean = false;
        filtered = filtered.replace(regex, '***');
      }
    }

    return { clean, filtered };
  }

  /**
   * 检查发送频率（Redis 滑动窗口）
   * 无 Redis 时直接放行
   */
  async checkRateLimit(
    userId: string,
  ): Promise<{ allowed: boolean; reason?: string }> {
    if (!this.redis.connected) return { allowed: true };

    const key = `chat:rate:${userId}`;
    const count = await this.redis.incr(key);

    // 首次设置过期时间
    if (count === 1) {
      await this.redis.expire(key, this.RATE_WINDOW);
    }

    if (count > this.RATE_LIMIT) {
      return { allowed: false, reason: 'RATE_LIMIT_EXCEEDED' };
    }

    return { allowed: true };
  }

  /**
   * 检查重复内容（Redis hash 计数）
   * 无 Redis 时直接放行
   */
  async checkRepeat(
    userId: string,
    content: string,
  ): Promise<{ allowed: boolean; reason?: string }> {
    if (!this.redis.connected) return { allowed: true };

    const hash = crypto
      .createHash('md5')
      .update(content.trim())
      .digest('hex')
      .slice(0, 12);
    const key = `chat:repeat:${userId}:${hash}`;

    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, this.REPEAT_WINDOW);
    }

    if (count > this.REPEAT_LIMIT) {
      return { allowed: false, reason: 'REPEATED_CONTENT' };
    }

    return { allowed: true };
  }

  /**
   * 综合校验（频率 + 重复 + 敏感词）
   */
  async validate(
    userId: string,
    content: string,
  ): Promise<{ allowed: boolean; filtered: string; reason?: string }> {
    // 1. 频率检查
    const rateCheck = await this.checkRateLimit(userId);
    if (!rateCheck.allowed) {
      return { allowed: false, filtered: content, reason: rateCheck.reason };
    }

    // 2. 重复检查
    const repeatCheck = await this.checkRepeat(userId, content);
    if (!repeatCheck.allowed) {
      return { allowed: false, filtered: content, reason: repeatCheck.reason };
    }

    // 3. 敏感词过滤（不拦截，替换后放行）
    const { filtered } = this.filterContent(content);

    return { allowed: true, filtered };
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
