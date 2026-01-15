import { Injectable, BadRequestException } from '@nestjs/common';

/**
 * 论坛内容审核服务
 * 提供敏感词过滤、内容检测等功能
 */
@Injectable()
export class ForumModerationService {
  // 敏感词库 - 基础示例,实际应用中可以从数据库或配置文件加载
  private readonly sensitivePatterns: RegExp[] = [
    // 广告推广
    /微信号|QQ群|加群|代写|代申|中介费/gi,
    // 不当内容
    /傻逼|智障|垃圾|废物|滚蛋/gi,
    // 虚假信息相关
    /保录取|包过|100%录取|guaranteed admission/gi,
    // 诈骗相关
    /转账|汇款|付款码|收款码/gi,
  ];

  // 可疑词汇 (会触发警告但不会阻止发布)
  private readonly suspiciousPatterns: RegExp[] = [
    /免费|优惠|折扣|限时|仅限/gi,
    /私聊|加我|联系方式/gi,
  ];

  /**
   * 检测内容是否包含敏感词
   */
  async filterContent(content: string): Promise<{
    isClean: boolean;
    hasSuspicious: boolean;
    detectedSensitive: string[];
    detectedSuspicious: string[];
    filteredContent: string;
  }> {
    const detectedSensitive: string[] = [];
    const detectedSuspicious: string[] = [];
    let filteredContent = content;

    // 检测敏感词
    for (const pattern of this.sensitivePatterns) {
      const matches = content.match(pattern);
      if (matches) {
        detectedSensitive.push(...matches);
        // 替换敏感词为星号
        filteredContent = filteredContent.replace(pattern, (match) =>
          '*'.repeat(match.length),
        );
      }
    }

    // 检测可疑词汇
    for (const pattern of this.suspiciousPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        detectedSuspicious.push(...matches);
      }
    }

    return {
      isClean: detectedSensitive.length === 0,
      hasSuspicious: detectedSuspicious.length > 0,
      detectedSensitive: [...new Set(detectedSensitive)], // 去重
      detectedSuspicious: [...new Set(detectedSuspicious)],
      filteredContent,
    };
  }

  /**
   * 验证帖子/评论内容
   * 如果包含敏感词则抛出异常
   */
  async validateContent(
    content: string,
    context: string = '内容',
  ): Promise<void> {
    const result = await this.filterContent(content);

    if (!result.isClean) {
      throw new BadRequestException(
        `${context}包含不当词汇，请修改后重试 / Content contains inappropriate words`,
      );
    }
  }

  /**
   * 批量检测多个文本
   */
  async validateMultiple(
    texts: { content: string; context: string }[],
  ): Promise<void> {
    for (const { content, context } of texts) {
      if (content) {
        await this.validateContent(content, context);
      }
    }
  }

  /**
   * 检测URL (防止外链广告)
   */
  containsUrl(content: string): boolean {
    const urlPattern = /https?:\/\/[^\s]+|www\.[^\s]+/gi;
    return urlPattern.test(content);
  }

  /**
   * 检测重复内容 (防止刷屏)
   */
  hasExcessiveRepetition(content: string): boolean {
    // 检测连续重复字符 (超过5个)
    const repetitionPattern = /(.)\1{5,}/;
    return repetitionPattern.test(content);
  }

  /**
   * 综合内容检查
   */
  async comprehensiveCheck(content: string): Promise<{
    passed: boolean;
    warnings: string[];
    errors: string[];
  }> {
    const warnings: string[] = [];
    const errors: string[] = [];

    // 敏感词检查
    const filterResult = await this.filterContent(content);
    if (!filterResult.isClean) {
      errors.push(`检测到敏感词: ${filterResult.detectedSensitive.join(', ')}`);
    }
    if (filterResult.hasSuspicious) {
      warnings.push(
        `检测到可疑词汇: ${filterResult.detectedSuspicious.join(', ')}`,
      );
    }

    // URL检查
    if (this.containsUrl(content)) {
      warnings.push('内容包含外部链接');
    }

    // 重复内容检查
    if (this.hasExcessiveRepetition(content)) {
      warnings.push('内容包含大量重复字符');
    }

    // 内容长度检查
    if (content.length < 10) {
      warnings.push('内容过短，建议丰富内容');
    }

    return {
      passed: errors.length === 0,
      warnings,
      errors,
    };
  }
}
