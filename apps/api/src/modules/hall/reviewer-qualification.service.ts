import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ReviewerLevel } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PointsService, PointAction } from '../points/incentive.service';
import { fireAndForget } from '../../common/utils/async.util';

/**
 * Hall refactor Stage 2 — Reviewer L2 qualification quiz.
 *
 * Gates users from L1 (vote-only) to L2 (full review权限) via a 3-question
 * quiz built from real admit/deny cases. Passing threshold is 60% (2/3).
 * Promotes to L3 still requires VERIFIED role + ≥5 reviews — handled
 * elsewhere; this service only handles the L1→L2 step.
 *
 * Question bank is intentionally hard-coded (small + curated) for MVP.
 * Stage 6 will move to a curated DB-backed pool driven by gold-cases.
 */
@Injectable()
export class ReviewerQualificationService {
  private readonly logger = new Logger(ReviewerQualificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pointsService: PointsService,
  ) {}

  /**
   * Return the 3-question quiz for the caller. Same 3 questions for now —
   * Stage 6 will rotate from a larger curated pool.
   */
  async getQuestions(userId: string): Promise<QualificationQuestion[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { reviewerLevel: true },
    });
    if (user?.reviewerLevel && user.reviewerLevel !== ReviewerLevel.L1) {
      throw new BadRequestException('Already qualified as L2 or higher');
    }
    // Strip `correctAnswer` — never send it to the client.
    return QUESTION_BANK.map(({ correctAnswer: _omit, ...rest }) => rest);
  }

  /**
   * Score the user's answers and promote on pass.
   */
  async submitAnswers(
    userId: string,
    answers: QualificationAnswer[],
  ): Promise<QualificationResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { reviewerLevel: true },
    });
    if (!user) {
      throw new BadRequestException('User not found');
    }
    if (user.reviewerLevel !== ReviewerLevel.L1) {
      throw new BadRequestException('Already qualified as L2 or higher');
    }

    const correctById = new Map(
      QUESTION_BANK.map((q) => [q.id, q.correctAnswer]),
    );
    let correct = 0;
    const breakdown: QualificationResult['breakdown'] = answers.map((a) => {
      const expected = correctById.get(a.questionId);
      const isCorrect = expected !== undefined && expected === a.answer;
      if (isCorrect) correct++;
      return { questionId: a.questionId, isCorrect };
    });

    const total = QUESTION_BANK.length;
    const passed = correct / total >= PASS_THRESHOLD;

    if (passed) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          reviewerLevel: ReviewerLevel.L2,
          reviewerQualifiedAt: new Date(),
        },
      });
      fireAndForget(
        this.pointsService.adjustPoints(userId, PointAction.REVIEWER_LEVEL_UP, {
          fromLevel: 'L1',
          toLevel: 'L2',
          score: `${correct}/${total}`,
        }),
        this.logger,
        'Failed to award REVIEWER_LEVEL_UP',
      );
      this.logger.log(
        `User ${userId} promoted to L2 reviewer (${correct}/${total})`,
      );
    }

    return {
      correct,
      total,
      passed,
      promotedTo: passed ? ReviewerLevel.L2 : null,
      breakdown,
    };
  }
}

// ============== Types ==============

export interface QualificationQuestion {
  id: string;
  prompt: string;
  context: string; // brief profile snapshot
  options: Array<{ value: 'admit' | 'reject' | 'waitlist'; label: string }>;
}

interface QualificationQuestionWithAnswer extends QualificationQuestion {
  correctAnswer: 'admit' | 'reject' | 'waitlist';
}

export interface QualificationAnswer {
  questionId: string;
  answer: 'admit' | 'reject' | 'waitlist';
}

export interface QualificationResult {
  correct: number;
  total: number;
  passed: boolean;
  promotedTo: ReviewerLevel | null;
  breakdown: Array<{ questionId: string; isCorrect: boolean }>;
}

// ============== Constants ==============

const PASS_THRESHOLD = 0.6; // 60% = 2/3 correct

/**
 * MVP question bank. Each question shows an anonymized real admit/deny case
 * and asks the reviewer to predict the outcome. Sourced from
 * `apps/api/gold-cases/counselor/cases/` (Stage 6 will automate this).
 */
const QUESTION_BANK: QualificationQuestionWithAnswer[] = [
  {
    id: 'q1',
    prompt:
      '此申请者 ED 申请 Cornell CS，结果是？（背景：上海一线国际部 IB，HL 数学 7、CS 7、物理 6；SAT 1530（M790 EBRW740）；USACO Platinum；3 年开源项目，GitHub 800+ star；中文区 TA 经验）',
    context: 'GPA: top 5% / SAT 1530 / USACO Platinum / 强 CS 主线',
    options: [
      { value: 'admit', label: '录取 Admit' },
      { value: 'reject', label: '拒 Reject' },
      { value: 'waitlist', label: '候补 Waitlist' },
    ],
    correctAnswer: 'admit',
  },
  {
    id: 'q2',
    prompt:
      '此申请者 RD 申请 Stanford CS，结果是？（背景：北京公立 AP，GPA 3.93/4.0；SAT 1480（M780 EBRW700）；AMC 12 区域奖；活动：机器人 + 模联 + 钢琴 + 数学竞赛 + 慈善（5 个并行无明显主线）；推荐信普通）',
    context: 'GPA: 3.93 / SAT 1480 / 活动分散无主线 / Standard Asian profile',
    options: [
      { value: 'admit', label: '录取 Admit' },
      { value: 'reject', label: '拒 Reject' },
      { value: 'waitlist', label: '候补 Waitlist' },
    ],
    correctAnswer: 'reject',
  },
  {
    id: 'q3',
    prompt:
      '此申请者 RD 申请 UPenn Wharton，结果是？（背景：深圳国际学校 A-Level，AAA*；SAT 1500（M770 EBRW730）；商赛 FBLA 国家级；高一起创办校园金融教育社团 200+ 成员；3 段 finance/consulting 实习；推荐信强）',
    context: 'GPA: 顶尖 / SAT 1500 / 商赛 + 创业 + 实习 / 主线清晰',
    options: [
      { value: 'admit', label: '录取 Admit' },
      { value: 'reject', label: '拒 Reject' },
      { value: 'waitlist', label: '候补 Waitlist' },
    ],
    correctAnswer: 'waitlist',
  },
];
