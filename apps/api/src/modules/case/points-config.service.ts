import { Injectable, Logger } from '@nestjs/common';
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

  // Spending points
  VIEW_CASE_DETAIL = 'VIEW_CASE_DETAIL',
  AI_ANALYSIS = 'AI_ANALYSIS',
  MESSAGE_VERIFIED = 'MESSAGE_VERIFIED',
  AI_ESSAY_POLISH = 'AI_ESSAY_POLISH',
  AI_ESSAY_REVIEW = 'AI_ESSAY_REVIEW',
  AI_ESSAY_BRAINSTORM = 'AI_ESSAY_BRAINSTORM',
  AI_ESSAY_GALLERY = 'AI_ESSAY_GALLERY',
  AI_SCHOOL_RECOMMENDATION = 'AI_SCHOOL_RECOMMENDATION',
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
  [PointAction.VIEW_CASE_DETAIL]: {
    settingKey: SETTING_KEYS.POINTS_ACTION_VIEW_CASE_DETAIL,
    defaultPoints: -20,
    description: '查看案例详情',
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
  [PointAction.AI_SCHOOL_RECOMMENDATION]: {
    settingKey: SETTING_KEYS.POINTS_ACTION_AI_SCHOOL_RECOMMENDATION,
    defaultPoints: -25,
    description: 'AI选校推荐',
    type: 'spend',
  },
};

@Injectable()
export class PointsConfigService {
  private readonly logger = new Logger(PointsConfigService.name);

  constructor(private readonly settingsService: SettingsService) {}

  /**
   * Check if the points system is enabled (runtime, from DB/Redis cache)
   */
  async isEnabled(): Promise<boolean> {
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
      throw new Error(`Unknown point action: ${action}`);
    }
    await this.settingsService.set(registry.settingKey, String(value));
    this.logger.log(`Point value for ${action} updated to ${value}`);
  }

  /**
   * Toggle the points system on/off
   */
  async setEnabled(enabled: boolean): Promise<void> {
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
