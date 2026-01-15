import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface DashboardSummary {
  // 用户基本信息
  user: {
    email: string;
    role: string;
    points: number;
    createdAt: string;
  };

  // 档案信息
  profile: {
    completeness: number;
    hasTestScores: boolean;
    hasActivities: boolean;
    hasAwards: boolean;
    targetSchoolCount: number;
    essayCount: number;
  };

  // 统计数据
  stats: {
    followers: number;
    following: number;
    cases: number;
    predictions: number;
  };

  // 即将截止的申请
  upcomingDeadlines: {
    id: string;
    schoolName: string;
    round: string;
    deadline: string;
    daysLeft: number;
  }[];

  // 最近活动
  recentActivity: {
    type: string;
    title: string;
    description: string;
    createdAt: string;
  }[];
}

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getDashboardSummary(userId: string): Promise<DashboardSummary> {
    // 并行获取所有数据
    const [
      user,
      profile,
      followStats,
      casesCount,
      predictionsCount,
      timelines,
      pointHistory,
    ] = await Promise.all([
      // 用户信息
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, role: true, points: true, createdAt: true },
      }),

      // 档案信息
      this.prisma.profile.findUnique({
        where: { userId },
        include: {
          testScores: { select: { id: true } },
          activities: { select: { id: true } },
          awards: { select: { id: true } },
          essays: { select: { id: true } },
        },
      }),

      // 关注统计
      this.prisma.$transaction([
        this.prisma.follow.count({ where: { followingId: userId } }),
        this.prisma.follow.count({ where: { followerId: userId } }),
      ]),

      // 案例数
      this.prisma.admissionCase.count({ where: { userId } }),

      // 预测数
      this.prisma.predictionResult.count({
        where: { profile: { userId } },
      }),

      // 时间线（即将截止）
      this.prisma.applicationTimeline.findMany({
        where: {
          userId,
          status: {
            notIn: [
              'SUBMITTED',
              'ACCEPTED',
              'REJECTED',
              'WAITLISTED',
              'WITHDRAWN',
            ],
          },
          deadline: { gte: new Date() },
        },
        orderBy: { deadline: 'asc' },
        take: 5,
        include: {
          school: { select: { name: true, nameZh: true } },
        },
      }),

      // 最近积分变动
      this.prisma.pointHistory.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    // 计算档案完成度
    const completeness = this.calculateProfileCompleteness(profile);

    // 计算截止日期
    const upcomingDeadlines = timelines.map((t) => ({
      id: t.id,
      schoolName: t.school?.nameZh || t.school?.name || 'Unknown',
      round: t.round,
      deadline: t.deadline.toISOString(),
      daysLeft: Math.ceil(
        (t.deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      ),
    }));

    // 构建最近活动
    const recentActivity = this.buildRecentActivity(pointHistory);

    return {
      user: {
        email: user?.email || '',
        role: user?.role || 'USER',
        points: user?.points || 0,
        createdAt: user?.createdAt.toISOString() || '',
      },
      profile: {
        completeness,
        hasTestScores: (profile?.testScores?.length || 0) > 0,
        hasActivities: (profile?.activities?.length || 0) > 0,
        hasAwards: (profile?.awards?.length || 0) > 0,
        targetSchoolCount: 0, // TODO: 需要从ProfileTargetSchool表查询
        essayCount: profile?.essays?.length || 0,
      },
      stats: {
        followers: followStats[0],
        following: followStats[1],
        cases: casesCount,
        predictions: predictionsCount,
      },
      upcomingDeadlines,
      recentActivity,
    };
  }

  private calculateProfileCompleteness(profile: any): number {
    if (!profile) return 0;

    let score = 0;
    const weights = {
      basicInfo: 20, // 基本信息
      testScores: 25, // 标化成绩
      gpa: 15, // GPA
      activities: 20, // 活动
      awards: 10, // 奖项
      targetSchools: 10, // 目标学校
    };

    // 基本信息
    if (profile.targetMajor || profile.grade) score += weights.basicInfo;

    // 标化成绩
    if (profile.testScores?.length > 0) score += weights.testScores;

    // GPA
    if (profile.gpa) score += weights.gpa;

    // 活动
    if (profile.activities?.length > 0) score += weights.activities;

    // 奖项
    if (profile.awards?.length > 0) score += weights.awards;

    // 目标学校 - TODO: 需要从ProfileTargetSchool表查询
    // if (profile.targetSchools?.length > 0) score += weights.targetSchools;

    return Math.min(100, score);
  }

  private buildRecentActivity(
    pointHistory: any[],
  ): DashboardSummary['recentActivity'] {
    const actionDescriptions: Record<string, { title: string; desc: string }> =
      {
        SUBMIT_CASE: { title: '提交案例', desc: '分享了录取案例' },
        CASE_VERIFIED: { title: '案例认证', desc: '案例通过审核' },
        COMPLETE_PROFILE: { title: '完善档案', desc: '更新了个人档案' },
        VIEW_CASE_DETAIL: { title: '查看案例', desc: '浏览了录取案例详情' },
        AI_ANALYSIS: { title: 'AI分析', desc: '使用了AI智能分析' },
        ESSAY_POLISH: { title: '文书润色', desc: '使用了文书润色服务' },
        ESSAY_REVIEW: { title: '文书评审', desc: '获取了AI文书评审' },
      };

    return pointHistory.map((h) => {
      const info = actionDescriptions[h.action] || {
        title: h.action,
        desc: '',
      };
      return {
        type: h.points > 0 ? 'earn' : 'spend',
        title: info.title,
        description: `${info.desc}${h.points > 0 ? `，获得 ${h.points} 积分` : ''}`,
        createdAt: h.createdAt.toISOString(),
      };
    });
  }
}
