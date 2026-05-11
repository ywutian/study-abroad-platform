import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { getSchoolDisplayName } from '../../common/utils/locale.util';

export interface DashboardSummary {
  // 用户基本信息
  user: {
    email: string;
    role: string;
    points: number;
    createdAt: string;
    nickname?: string;
  };

  // 档案信息
  profile: {
    completeness: number;
    hasTestScores: boolean;
    hasActivities: boolean;
    hasAwards: boolean;
    hasEducation: boolean;
    targetSchoolCount: number;
    essayCount: number;
    schoolTiers: {
      reach: number;
      target: number;
      safety: number;
    };
  };

  // 统计数据
  stats: {
    followers: number;
    following: number;
    cases: number;
    predictions: number;
  };

  // 待办任务
  pendingTasks: {
    total: number;
    byType: { type: string; count: number }[];
    profileGaps: string[];
  };

  // 即将截止的申请
  upcomingDeadlines: {
    id: string;
    schoolName: string;
    round: string;
    deadline: string;
    daysLeft: number;
  }[];

  // 即将到期的个人事件（比赛/考试等）
  upcomingPersonalEvents: {
    id: string;
    title: string;
    category: string;
    deadline: string | null;
    eventDate: string | null;
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

  async getDashboardSummary(
    userId: string,
    locale = 'zh',
  ): Promise<DashboardSummary> {
    // 并行获取所有数据
    const now = new Date();
    const [
      user,
      profile,
      followStats,
      casesCount,
      predictionsCount,
      timelines,
      pointHistory,
      schoolListCount,
      schoolTierGroups,
      pendingTaskCount,
      pendingTaskTypes,
      personalEvents,
      schoolListWithDeadlines,
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
          education: { select: { id: true } },
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

      // 选校清单总数
      this.prisma.schoolListItem.count({ where: { userId } }),

      // 选校 Tier 分布
      this.prisma.schoolListItem.groupBy({
        by: ['tier'],
        where: { userId },
        _count: { tier: true },
      }),

      // 待办任务（未完成的 ApplicationTask）
      this.prisma.applicationTask.count({
        where: { timeline: { userId }, completed: false },
      }),

      // 待办任务按类型分组
      this.prisma.applicationTask.groupBy({
        by: ['type'],
        where: { timeline: { userId }, completed: false },
        _count: { type: true },
      }),

      // 即将到期的个人事件（比赛/考试）：deadline 或 eventDate 在未来
      this.prisma.personalEvent.findMany({
        where: {
          userId,
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
          OR: [{ deadline: { gte: now } }, { eventDate: { gte: now } }],
        },
        orderBy: [{ deadline: 'asc' }, { eventDate: 'asc' }],
        take: 5,
        select: {
          id: true,
          title: true,
          category: true,
          deadline: true,
          eventDate: true,
        },
      }),

      // 选校清单中学校的截止日期（SchoolDeadline），用于补充没有生成 ApplicationTimeline 的学校
      this.prisma.schoolListItem.findMany({
        where: { userId },
        select: {
          schoolId: true,
          round: true,
          school: {
            select: {
              name: true,
              nameZh: true,
              deadlines: {
                where: { applicationDeadline: { gte: now } },
                orderBy: { applicationDeadline: 'asc' },
              },
            },
          },
        },
      }),
    ]);

    // 计算档案完成度（传入选校数据用于权重计算）
    const { completeness, profileGaps } = this.calculateProfileCompleteness(
      profile,
      schoolListCount,
    );

    // 解析 Tier 分布
    const schoolTiers = { reach: 0, target: 0, safety: 0 };
    for (const row of schoolTierGroups) {
      const tierKey = row.tier.toLowerCase() as keyof typeof schoolTiers;
      if (tierKey in schoolTiers) {
        schoolTiers[tierKey] = row._count.tier;
      }
    }

    // 待办任务按类型
    const tasksByType = pendingTaskTypes.map((row) => ({
      type: row.type,
      count: row._count.type,
    }));

    // 计算截止日期：来自已生成的 ApplicationTimeline
    const timelineDeadlines = timelines
      .filter((t) => t.deadline !== null)
      .map((t) => ({
        id: t.id,
        schoolName: t.school
          ? getSchoolDisplayName(t.school, locale)
          : 'Unknown',
        round: t.round,
        deadline: t.deadline!.toISOString(),
        daysLeft: Math.ceil(
          (t.deadline!.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
        ),
      }));

    // 补充来自 SchoolDeadline 的截止日期（选校清单中但尚未生成 Timeline 的学校）
    const timelineSchoolRounds = new Set(
      timelines.map((t) => `${t.schoolId}:${t.round}`),
    );
    const schoolDeadlineItems: typeof timelineDeadlines = [];
    for (const item of schoolListWithDeadlines) {
      if (!item.school?.deadlines) continue;
      for (const dl of item.school.deadlines) {
        if (timelineSchoolRounds.has(`${item.schoolId}:${dl.round}`)) continue;
        if (item.round && item.round !== dl.round) continue;
        schoolDeadlineItems.push({
          id: dl.id,
          schoolName: getSchoolDisplayName(item.school, locale),
          round: dl.round,
          deadline: dl.applicationDeadline.toISOString(),
          daysLeft: Math.ceil(
            (dl.applicationDeadline.getTime() - Date.now()) /
              (1000 * 60 * 60 * 24),
          ),
        });
      }
    }

    const upcomingDeadlines = [...timelineDeadlines, ...schoolDeadlineItems]
      .sort(
        (a, b) =>
          new Date(a.deadline).getTime() - new Date(b.deadline).getTime(),
      )
      .slice(0, 10);

    const upcomingPersonalEvents = personalEvents.map((ev) => {
      const date = ev.deadline ?? ev.eventDate!;
      const daysLeft = Math.ceil(
        (date.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      );
      return {
        id: ev.id,
        title: ev.title,
        category: ev.category,
        deadline: ev.deadline?.toISOString() ?? null,
        eventDate: ev.eventDate?.toISOString() ?? null,
        daysLeft,
      };
    });

    // 构建最近活动
    const recentActivity = this.buildRecentActivity(pointHistory);

    return {
      user: {
        email: user?.email || '',
        role: user?.role || 'USER',
        points: user?.points || 0,
        createdAt: user?.createdAt.toISOString() || '',
        nickname: profile?.nickname || undefined,
      },
      profile: {
        completeness,
        hasTestScores: (profile?.testScores?.length || 0) > 0,
        hasActivities: (profile?.activities?.length || 0) > 0,
        hasAwards: (profile?.awards?.length || 0) > 0,
        hasEducation: (profile?.education?.length || 0) > 0,
        targetSchoolCount: schoolListCount,
        essayCount: profile?.essays?.length || 0,
        schoolTiers,
      },
      stats: {
        followers: followStats[0],
        following: followStats[1],
        cases: casesCount,
        predictions: predictionsCount,
      },
      pendingTasks: {
        total: pendingTaskCount,
        byType: tasksByType,
        profileGaps,
      },
      upcomingDeadlines,
      upcomingPersonalEvents,
      recentActivity,
    };
  }

  private calculateProfileCompleteness(
    profile: any,
    schoolListCount: number,
  ): { completeness: number; profileGaps: string[] } {
    if (!profile) {
      return {
        completeness: 0,
        profileGaps: [
          'basicInfo',
          'gpa',
          'testScores',
          'activities',
          'awards',
          'targetSchools',
        ],
      };
    }

    let score = 0;
    const gaps: string[] = [];

    // Industry priority: GPA + rigor first, tests second.
    // When applyingTestOptional is true, the testScores weight is redistributed to GPA
    // so test-optional applicants are not penalized for missing standardized scores.
    const isTestOptional = profile.applyingTestOptional === true;
    const weights = {
      basicInfo: 20,
      gpa: isTestOptional ? 35 : 25, // GPA is the #1 academic signal
      testScores: isTestOptional ? 0 : 15,
      activities: 20,
      awards: 10,
      targetSchools: 10,
    };

    // 基本信息
    if (profile.targetMajor || profile.grade) {
      score += weights.basicInfo;
    } else {
      gaps.push('basicInfo');
    }

    // GPA
    if (profile.gpa) {
      score += weights.gpa;
    } else {
      gaps.push('gpa');
    }

    // 标化成绩 — skipped when test-optional (weight is 0)
    if (!isTestOptional) {
      if (profile.testScores?.length > 0) {
        score += weights.testScores;
      } else {
        gaps.push('testScores');
      }
    }

    // 活动
    if (profile.activities?.length > 0) {
      score += weights.activities;
    } else {
      gaps.push('activities');
    }

    // 奖项
    if (profile.awards?.length > 0) {
      score += weights.awards;
    } else {
      gaps.push('awards');
    }

    // 目标学校（使用 SchoolListItem 数据）
    if (schoolListCount > 0) {
      score += weights.targetSchools;
    } else {
      gaps.push('targetSchools');
    }

    return { completeness: Math.min(100, score), profileGaps: gaps };
  }

  private buildRecentActivity(
    pointHistory: any[],
  ): DashboardSummary['recentActivity'] {
    const actionDescriptions: Record<string, { title: string; desc: string }> =
      {
        // Earning points
        SUBMIT_CASE: { title: '提交案例', desc: '分享了录取案例' },
        CASE_VERIFIED: { title: '案例认证', desc: '案例通过审核' },
        CASE_HELPFUL: { title: '案例获赞', desc: '案例被标记为有帮助' },
        COMPLETE_PROFILE: { title: '完善档案', desc: '更新了个人档案' },
        REFER_USER: { title: '邀请好友', desc: '成功邀请新用户注册' },
        VERIFICATION_APPROVED: {
          title: '认证通过',
          desc: '身份认证已通过审核',
        },
        SWIPE_CORRECT: { title: '预测正确', desc: '案例预测判断正确' },
        SUBMIT_REVIEW: { title: '提交评审', desc: '发表了案例评审' },
        REVIEW_HELPFUL: { title: '评审获赞', desc: '评审被标记为有帮助' },
        // Spending points
        VIEW_CASE_DETAIL: { title: '查看案例', desc: '浏览了录取案例详情' },
        AI_ANALYSIS: { title: 'AI分析', desc: '使用了AI智能分析' },
        MESSAGE_VERIFIED: {
          title: '私信认证用户',
          desc: '向认证用户发送了私信',
        },
        AI_ESSAY_POLISH: { title: '文书润色', desc: '使用了AI文书润色' },
        AI_ESSAY_REVIEW: { title: '文书评审', desc: '获取了AI文书评审' },
        AI_ESSAY_BRAINSTORM: {
          title: '文书头脑风暴',
          desc: '使用了AI头脑风暴',
        },
        AI_ESSAY_GALLERY: { title: '文书画廊', desc: '查看了文书画廊内容' },
        AI_SCHOOL_RECOMMENDATION: {
          title: 'AI选校推荐',
          desc: '获取了AI选校推荐',
        },
      };

    return pointHistory.map((h) => {
      const info = actionDescriptions[h.action] || {
        title: h.action,
        desc: '',
      };
      return {
        type: h.points > 0 ? 'earn' : 'spend',
        title: info.title,
        description: `${info.desc}${h.points > 0 ? `，获得 ${h.points} 积分` : `，消耗 ${Math.abs(h.points)} 积分`}`,
        createdAt: h.createdAt.toISOString(),
      };
    });
  }
}
