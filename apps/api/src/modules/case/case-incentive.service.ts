import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * 案例提交激励系统
 * 
 * 设计理念：用户生成内容(UGC) + 积分激励
 * 这是最合规且可持续的数据获取方式
 */

export enum PointAction {
  // 获得积分
  SUBMIT_CASE = 'SUBMIT_CASE',           // 提交案例 +50
  CASE_VERIFIED = 'CASE_VERIFIED',       // 案例被验证 +100
  CASE_HELPFUL = 'CASE_HELPFUL',         // 案例被标记有帮助 +10
  COMPLETE_PROFILE = 'COMPLETE_PROFILE', // 完善档案 +30
  REFER_USER = 'REFER_USER',             // 推荐新用户 +50
  
  // 消耗积分
  VIEW_CASE_DETAIL = 'VIEW_CASE_DETAIL', // 查看案例详情 -20
  AI_ANALYSIS = 'AI_ANALYSIS',           // AI分析 -30
  MESSAGE_VERIFIED = 'MESSAGE_VERIFIED', // 私信认证用户 -10
}

const POINT_VALUES: Record<PointAction, number> = {
  [PointAction.SUBMIT_CASE]: 50,
  [PointAction.CASE_VERIFIED]: 100,
  [PointAction.CASE_HELPFUL]: 10,
  [PointAction.COMPLETE_PROFILE]: 30,
  [PointAction.REFER_USER]: 50,
  [PointAction.VIEW_CASE_DETAIL]: -20,
  [PointAction.AI_ANALYSIS]: -30,
  [PointAction.MESSAGE_VERIFIED]: -10,
};

@Injectable()
export class CaseIncentiveService {
  private readonly logger = new Logger(CaseIncentiveService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * 获取用户积分
   */
  async getUserPoints(userId: string): Promise<number> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { points: true },
    });
    return user?.points || 0;
  }

  /**
   * 增加/扣除积分
   */
  async adjustPoints(
    userId: string,
    action: PointAction,
    metadata?: Record<string, unknown>,
  ): Promise<{ success: boolean; newBalance: number; message?: string }> {
    const pointValue = POINT_VALUES[action];
    const currentPoints = await this.getUserPoints(userId);

    // 检查是否有足够积分（扣除情况）
    if (pointValue < 0 && currentPoints + pointValue < 0) {
      return {
        success: false,
        newBalance: currentPoints,
        message: '积分不足',
      };
    }

    // 更新积分
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { points: { increment: pointValue } },
      select: { points: true },
    });

    // 记录积分变动
    await this.prisma.pointHistory.create({
      data: {
        userId,
        action,
        points: pointValue,
        metadata: (metadata || {}) as any,
      },
    });

    this.logger.log(`User ${userId} ${action}: ${pointValue > 0 ? '+' : ''}${pointValue} points`);

    return {
      success: true,
      newBalance: updated.points,
    };
  }

  /**
   * 检查用户是否可以执行某操作
   */
  async canPerformAction(userId: string, action: PointAction): Promise<boolean> {
    const pointValue = POINT_VALUES[action];
    
    // 获取积分的操作总是可以
    if (pointValue > 0) return true;
    
    const currentPoints = await this.getUserPoints(userId);
    return currentPoints + pointValue >= 0;
  }

  /**
   * 获取用户积分历史
   */
  async getPointHistory(userId: string, limit = 20) {
    return this.prisma.pointHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * 案例提交后的奖励流程
   */
  async rewardCaseSubmission(userId: string, caseId: string) {
    return this.adjustPoints(userId, PointAction.SUBMIT_CASE, { caseId });
  }

  /**
   * 案例被验证后的奖励
   */
  async rewardCaseVerification(userId: string, caseId: string) {
    return this.adjustPoints(userId, PointAction.CASE_VERIFIED, { caseId });
  }

  /**
   * 检查并扣除查看案例详情的积分
   */
  async chargeViewCaseDetail(userId: string, caseId: string): Promise<boolean> {
    // 检查是否已经查看过（免费）
    const viewed = await this.prisma.caseView.findUnique({
      where: { userId_caseId: { userId, caseId } },
    });

    if (viewed) return true; // 已经查看过，不再扣费

    // 尝试扣除积分
    const result = await this.adjustPoints(userId, PointAction.VIEW_CASE_DETAIL, { caseId });
    
    if (result.success) {
      // 记录查看
      await this.prisma.caseView.create({
        data: { userId, caseId },
      });
    }

    return result.success;
  }
}







