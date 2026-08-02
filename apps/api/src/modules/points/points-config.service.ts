import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { SettingsService, SETTING_KEYS } from '../settings/settings.service';

/**
 * All point actions in the system — unified registry
 */
export enum PointAction {
  // Earning points
  SUBMIT_CASE = 'SUBMIT_CASE',
  CASE_VERIFIED = 'CASE_VERIFIED',
  CASE_HELPFUL = 'CASE_HELPFUL',
  COMPLETE_PROFILE = 'COMPLETE_PROFILE',
  REFER_USER = 'REFER_USER',
  VERIFICATION_APPROVED = 'VERIFICATION_APPROVED',
  SWIPE_CORRECT = 'SWIPE_CORRECT',
  SUBMIT_REVIEW = 'SUBMIT_REVIEW',
  REVIEW_HELPFUL = 'REVIEW_HELPFUL',
  // Hall refactor Phase 1: review/challenge/application-progress incentives
  REVIEW_SWIPE_COMPLETE = 'REVIEW_SWIPE_COMPLETE',
  REVIEW_HELPFUL_RECEIVED = 'REVIEW_HELPFUL_RECEIVED',
  REVIEWER_LEVEL_UP = 'REVIEWER_LEVEL_UP',
  CHALLENGE_COMPLETE = 'CHALLENGE_COMPLETE',
  CASE_STUDY_COMPLETE = 'CASE_STUDY_COMPLETE',
  PROFILE_RESEARCHED_5_SCHOOLS = 'PROFILE_RESEARCHED_5_SCHOOLS',
  ESSAY_DRAFT_COMPLETE = 'ESSAY_DRAFT_COMPLETE',
  ED_SUBMITTED = 'ED_SUBMITTED',

  // Spending points
  VIEW_CASE_DETAIL = 'VIEW_CASE_DETAIL',
  RANKING_ANALYZED = 'RANKING_ANALYZED',
  REVIEW_REPORTED = 'REVIEW_REPORTED', // 被举报扣分（负值由 admin 配置）
  AI_ANALYSIS = 'AI_ANALYSIS',
  MESSAGE_VERIFIED = 'MESSAGE_VERIFIED',
  AI_ESSAY_POLISH = 'AI_ESSAY_POLISH',
  AI_ESSAY_REVIEW = 'AI_ESSAY_REVIEW',
  AI_ESSAY_BRAINSTORM = 'AI_ESSAY_BRAINSTORM',
  AI_ESSAY_GALLERY = 'AI_ESSAY_GALLERY',
  AI_ESSAY_GALLERY_ASK = 'AI_ESSAY_GALLERY_ASK',
  AI_ESSAY_COMPARE = 'AI_ESSAY_COMPARE',
  AI_SCHOOL_RECOMMENDATION = 'AI_SCHOOL_RECOMMENDATION',
  AI_ACTIVITY_REFINE = 'AI_ACTIVITY_REFINE',
  // Phase 2 V1 (PR1) — one user "argue back" turn against AI essay feedback.
  // Skeleton ships at cost 0; real LLM integration + pricing land in PR2.
  AI_ESSAY_DEBATE_TURN = 'AI_ESSAY_DEBATE_TURN',
}

export interface PointRule {
  action: string;
  points: number;
  description: string;
  type: 'earn' | 'spend';
}

/**
 * Static registry with defaults and descriptions for all point actions
 */
const POINT_ACTION_REGISTRY: Record<
  PointAction,
  {
    settingKey: string;
    defaultPoints: number;
    description: string;
    type: 'earn' | 'spend';
  }
> = {
  [PointAction.SUBMIT_CASE]: {
    settingKey: SETTING_KEYS.POINTS_ACTION_SUBMIT_CASE,
    defaultPoints: 50,
    description: '提交录取案例',
    type: 'earn',
  },
  [PointAction.CASE_VERIFIED]: {
    settingKey: SETTING_KEYS.POINTS_ACTION_CASE_VERIFIED,
    defaultPoints: 100,
    description: '案例通过验证',
    type: 'earn',
  },
  [PointAction.CASE_HELPFUL]: {
    settingKey: SETTING_KEYS.POINTS_ACTION_CASE_HELPFUL,
    defaultPoints: 10,
    description: '案例被标记有帮助',
    type: 'earn',
  },
  [PointAction.COMPLETE_PROFILE]: {
    settingKey: SETTING_KEYS.POINTS_ACTION_COMPLETE_PROFILE,
    defaultPoints: 30,
    description: '完善个人档案',
    type: 'earn',
  },
  [PointAction.REFER_USER]: {
    settingKey: SETTING_KEYS.POINTS_ACTION_REFER_USER,
    defaultPoints: 50,
    description: '成功邀请新用户',
    type: 'earn',
  },
  [PointAction.VERIFICATION_APPROVED]: {
    settingKey: SETTING_KEYS.POINTS_ACTION_VERIFICATION_APPROVED,
    defaultPoints: 100,
    description: '身份认证通过',
    type: 'earn',
  },
  [PointAction.SWIPE_CORRECT]: {
    settingKey: SETTING_KEYS.POINTS_ACTION_SWIPE_CORRECT,
    defaultPoints: 5,
    description: '滑动猜测正确',
    type: 'earn',
  },
  [PointAction.SUBMIT_REVIEW]: {
    settingKey: SETTING_KEYS.POINTS_ACTION_SUBMIT_REVIEW,
    defaultPoints: 20,
    description: '发布锐评',
    type: 'earn',
  },
  [PointAction.REVIEW_HELPFUL]: {
    settingKey: SETTING_KEYS.POINTS_ACTION_REVIEW_HELPFUL,
    defaultPoints: 10,
    description: '锐评被标记为有帮助',
    type: 'earn',
  },
  // Hall refactor Phase 1 — Tinder review + challenge + application-progress actions
  [PointAction.REVIEW_SWIPE_COMPLETE]: {
    settingKey: SETTING_KEYS.POINTS_ACTION_REVIEW_SWIPE_COMPLETE,
    defaultPoints: 10,
    description: '完成 Tinder 风格 4 维滑动锐评（≥5 字理由）',
    type: 'earn',
  },
  [PointAction.REVIEW_HELPFUL_RECEIVED]: {
    settingKey: SETTING_KEYS.POINTS_ACTION_REVIEW_HELPFUL_RECEIVED,
    defaultPoints: 5,
    description: '滑动锐评被点 helpful（上限 20/条）',
    type: 'earn',
  },
  [PointAction.REVIEWER_LEVEL_UP]: {
    settingKey: SETTING_KEYS.POINTS_ACTION_REVIEWER_LEVEL_UP,
    defaultPoints: 50,
    description: '通过 L2 评审者资质测试升级',
    type: 'earn',
  },
  [PointAction.CHALLENGE_COMPLETE]: {
    settingKey: SETTING_KEYS.POINTS_ACTION_CHALLENGE_COMPLETE,
    defaultPoints: 20,
    description: '完成 1 次社区挑战（每日上限 1 次）',
    type: 'earn',
  },
  [PointAction.CASE_STUDY_COMPLETE]: {
    settingKey: SETTING_KEYS.POINTS_ACTION_CASE_STUDY_COMPLETE,
    defaultPoints: 5,
    description: '完成 1 个案例研习（含复盘笔记）',
    type: 'earn',
  },
  [PointAction.PROFILE_RESEARCHED_5_SCHOOLS]: {
    settingKey: SETTING_KEYS.POINTS_ACTION_PROFILE_RESEARCHED_5_SCHOOLS,
    defaultPoints: 30,
    description: '研究透 5 所目标学校（青铜段位）',
    type: 'earn',
  },
  [PointAction.ESSAY_DRAFT_COMPLETE]: {
    settingKey: SETTING_KEYS.POINTS_ACTION_ESSAY_DRAFT_COMPLETE,
    defaultPoints: 50,
    description: '完成 1 篇文书草稿（黄金段位）',
    type: 'earn',
  },
  [PointAction.ED_SUBMITTED]: {
    settingKey: SETTING_KEYS.POINTS_ACTION_ED_SUBMITTED,
    defaultPoints: 100,
    description: '提交 ED 申请（钻石段位）',
    type: 'earn',
  },
  [PointAction.VIEW_CASE_DETAIL]: {
    settingKey: SETTING_KEYS.POINTS_ACTION_VIEW_CASE_DETAIL,
    defaultPoints: -20,
    description: '查看案例详情',
    type: 'spend',
  },
  // Hall refactor Phase 1 — RANKING_ANALYZED 灰度先设 0，稳定后调 -10；REVIEW_REPORTED 由 admin 配置
  [PointAction.RANKING_ANALYZED]: {
    settingKey: SETTING_KEYS.POINTS_ACTION_RANKING_ANALYZED,
    defaultPoints: 0,
    description: '使用 AI 排名分析（灰度先 0，稳定后调 -10）',
    type: 'spend',
  },
  [PointAction.REVIEW_REPORTED]: {
    settingKey: SETTING_KEYS.POINTS_ACTION_REVIEW_REPORTED,
    defaultPoints: -20,
    description: '锐评被举报且 admin 判定属实（评审者扣分）',
    type: 'spend',
  },
  [PointAction.AI_ANALYSIS]: {
    settingKey: SETTING_KEYS.POINTS_ACTION_AI_ANALYSIS,
    defaultPoints: -30,
    description: 'AI智能分析',
    type: 'spend',
  },
  [PointAction.MESSAGE_VERIFIED]: {
    settingKey: SETTING_KEYS.POINTS_ACTION_MESSAGE_VERIFIED,
    defaultPoints: -10,
    description: '私信认证用户',
    type: 'spend',
  },
  [PointAction.AI_ESSAY_POLISH]: {
    settingKey: SETTING_KEYS.POINTS_ACTION_AI_ESSAY_POLISH,
    defaultPoints: -20,
    description: '文书润色服务',
    type: 'spend',
  },
  [PointAction.AI_ESSAY_REVIEW]: {
    settingKey: SETTING_KEYS.POINTS_ACTION_AI_ESSAY_REVIEW,
    defaultPoints: -30,
    description: '文书评审服务',
    type: 'spend',
  },
  [PointAction.AI_ESSAY_BRAINSTORM]: {
    settingKey: SETTING_KEYS.POINTS_ACTION_AI_ESSAY_BRAINSTORM,
    defaultPoints: -15,
    description: '文书头脑风暴',
    type: 'spend',
  },
  [PointAction.AI_ESSAY_GALLERY]: {
    settingKey: SETTING_KEYS.POINTS_ACTION_AI_ESSAY_GALLERY,
    defaultPoints: -20,
    description: '文书范例分析',
    type: 'spend',
  },
  [PointAction.AI_ESSAY_GALLERY_ASK]: {
    settingKey: SETTING_KEYS.POINTS_ACTION_AI_ESSAY_GALLERY_ASK,
    defaultPoints: -5,
    description: '围绕范文提问',
    type: 'spend',
  },
  [PointAction.AI_ESSAY_COMPARE]: {
    settingKey: SETTING_KEYS.POINTS_ACTION_AI_ESSAY_COMPARE,
    defaultPoints: -15,
    description: '用范文对比我的文书',
    type: 'spend',
  },
  [PointAction.AI_SCHOOL_RECOMMENDATION]: {
    settingKey: SETTING_KEYS.POINTS_ACTION_AI_SCHOOL_RECOMMENDATION,
    defaultPoints: -25,
    description: 'AI选校推荐',
    type: 'spend',
  },
  [PointAction.AI_ACTIVITY_REFINE]: {
    settingKey: SETTING_KEYS.POINTS_ACTION_AI_ACTIVITY_REFINE,
    defaultPoints: -15,
    description: 'AI活动描述精简',
    type: 'spend',
  },
  [PointAction.AI_ESSAY_DEBATE_TURN]: {
    settingKey: SETTING_KEYS.POINTS_ACTION_AI_ESSAY_DEBATE_TURN,
    // Skeleton ships at 0 — PR2 sets the real value after we measure
    // per-turn token cost against the $40/day system cap.
    defaultPoints: 0,
    description: '文书反驳一轮',
    type: 'spend',
  },
};

@Injectable()
export class PointsConfigService {
  private readonly logger = new Logger(PointsConfigService.name);

  /**
   * Product decision: the points economy is disabled and product capabilities
   * are available without point checks or deductions.
   *
   * Keep the persisted settings and ledger data intact so the feature can be
   * restored later, but never let an old `points_enabled=true` setting revive
   * charging/rewards while every client surface is hidden.
   */
  private static readonly FEATURE_AVAILABLE = false;

  constructor(private readonly settingsService: SettingsService) {}

  /**
   * Check if the points system is enabled (runtime, from DB/Redis cache)
   */
  async isEnabled(): Promise<boolean> {
    if (!PointsConfigService.FEATURE_AVAILABLE) return false;
    return this.settingsService.getTyped(SETTING_KEYS.POINTS_ENABLED, false);
  }

  /**
   * Get the point value for a specific action (runtime, from DB/Redis cache)
   */
  async getPointValue(action: PointAction): Promise<number> {
    const registry = POINT_ACTION_REGISTRY[action];
    if (!registry) return 0;
    return this.settingsService.getTyped(
      registry.settingKey,
      registry.defaultPoints,
    );
  }

  /**
   * Get all point rules with current dynamic values
   */
  async getAllRules(): Promise<PointRule[]> {
    const rules: PointRule[] = [];
    for (const [action, registry] of Object.entries(POINT_ACTION_REGISTRY)) {
      const points = await this.settingsService.getTyped(
        registry.settingKey,
        registry.defaultPoints,
      );
      rules.push({
        action,
        points,
        description: registry.description,
        type: registry.type,
      });
    }
    return rules;
  }

  /**
   * Get full config (enabled status + all action values)
   */
  async getFullConfig() {
    const enabled = await this.isEnabled();
    const rules = await this.getAllRules();
    return { enabled, rules };
  }

  /**
   * Update the point value for a specific action
   */
  async setPointValue(action: PointAction, value: number): Promise<void> {
    const registry = POINT_ACTION_REGISTRY[action];
    if (!registry) {
      throw new BadRequestException(`Unknown point action: ${action}`);
    }
    await this.settingsService.set(registry.settingKey, String(value));
    this.logger.log(`Point value for ${action} updated to ${value}`);
  }

  /**
   * Toggle the points system on/off
   */
  async setEnabled(enabled: boolean): Promise<void> {
    if (enabled && !PointsConfigService.FEATURE_AVAILABLE) {
      throw new BadRequestException(
        'Points economy is disabled; product features run without points',
      );
    }
    await this.settingsService.set(
      SETTING_KEYS.POINTS_ENABLED,
      String(enabled),
    );
    this.logger.log(`Points system ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Reset all point values to defaults
   */
  async resetToDefaults(): Promise<void> {
    for (const registry of Object.values(POINT_ACTION_REGISTRY)) {
      await this.settingsService.delete(registry.settingKey);
    }
    await this.settingsService.delete(SETTING_KEYS.POINTS_ENABLED);
    this.logger.log('Points config reset to defaults');
  }

  /**
   * Get the static registry (for reference/documentation)
   */
  getRegistry() {
    return POINT_ACTION_REGISTRY;
  }
}
