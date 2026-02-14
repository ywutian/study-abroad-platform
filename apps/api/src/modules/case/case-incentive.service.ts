import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PointsConfigService, PointAction } from './points-config.service';

// Re-export PointAction from the config service for backward compatibility
export { PointAction } from './points-config.service';

/**
 * 案例提交激励系统 — 统一积分操作中心
 *
 * 所有积分的增加/扣除都应通过此服务进行，
 * 不允许其他服务直接操作 user.points 或 pointHistory。
 * 积分值和开关状态从 PointsConfigService 动态读取（管理员可配置）。
 */
@Injectable()
export class CaseIncentiveService {
  private readonly logger = new Logger(CaseIncentiveService.name);

  constructor(
    private prisma: PrismaService,
    private pointsConfig: PointsConfigService,
  ) {}

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
   * 统一增加/扣除积分（核心方法）
   */
  async adjustPoints(
    userId: string,
    action: PointAction | string,
    metadata?: Record<string, unknown>,
    pointsOverride?: number,
  ): Promise<{ success: boolean; newBalance: number; message?: string }> {
    const enabled = await this.pointsConfig.isEnabled();
    if (!enabled) {
      return { success: true, newBalance: 0 };
    }

    // Get dynamic point value from config, or use override (for variable-value actions like swipe)
    const pointValue =
      pointsOverride ??
      (Object.values(PointAction).includes(action as PointAction)
        ? await this.pointsConfig.getPointValue(action as PointAction)
        : 0);

    if (pointValue === 0) {
      return { success: true, newBalance: await this.getUserPoints(userId) };
    }

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
        action: String(action),
        points: pointValue,
        metadata: (metadata || {}) as any,
      },
    });

    this.logger.log(
      `User ${userId} ${action}: ${pointValue > 0 ? '+' : ''}${pointValue} points`,
    );

    return {
      success: true,
      newBalance: updated.points,
    };
  }

  /**
   * 通用扣分入口（用于消耗积分的操作）
   * 如果积分不足，抛出 BadRequestException
   */
  async charge(
    userId: string,
    action: PointAction,
    metadata?: Record<string, unknown>,
  ): Promise<{ newBalance: number }> {
    const result = await this.adjustPoints(userId, action, metadata);
    if (!result.success) {
      const pointValue = await this.pointsConfig.getPointValue(action);
      throw new BadRequestException(
        `积分不足，需要 ${Math.abs(pointValue)} 积分`,
      );
    }
    return { newBalance: result.newBalance };
  }

  /**
   * 通用加分入口（用于奖励积分的操作）
   */
  async reward(
    userId: string,
    action: PointAction,
    metadata?: Record<string, unknown>,
  ): Promise<{ newBalance: number }> {
    const result = await this.adjustPoints(userId, action, metadata);
    return { newBalance: result.newBalance };
  }

  /**
   * 退款（返还积分）
   */
  async refund(
    userId: string,
    action: PointAction,
    metadata?: Record<string, unknown>,
  ): Promise<{ newBalance: number }> {
    // Get the absolute value and make it positive for refund
    const pointValue = await this.pointsConfig.getPointValue(action);
    const refundAmount = Math.abs(pointValue);
    const result = await this.adjustPoints(
      userId,
      `${action}_REFUND`,
      { ...metadata, reason: 'service_error' },
      refundAmount,
    );
    return { newBalance: result.newBalance };
  }

  /**
   * 检查用户是否可以执行某操作
   */
  async canPerformAction(
    userId: string,
    action: PointAction,
  ): Promise<boolean> {
    const enabled = await this.pointsConfig.isEnabled();
    if (!enabled) return true;

    const pointValue = await this.pointsConfig.getPointValue(action);

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
   * Reward a user for successfully referring a new user
   */
  async rewardReferral(referrerId: string, referredUserId: string) {
    return this.adjustPoints(referrerId, PointAction.REFER_USER, {
      referredUserId,
    });
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
    const result = await this.adjustPoints(
      userId,
      PointAction.VIEW_CASE_DETAIL,
      { caseId },
    );

    if (result.success) {
      // 记录查看
      await this.prisma.caseView.create({
        data: { userId, caseId },
      });
    }

    return result.success;
  }
}
