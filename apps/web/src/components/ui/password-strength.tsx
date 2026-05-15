'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { AlertCircle, Check, X } from 'lucide-react';
import {
  PASSWORD_POLICY,
  getPasswordPolicyChecks,
  getPasswordPolicyScore,
  getUnsupportedPasswordChars,
  isPasswordCompliant,
} from '@study-abroad/shared';
import { cn } from '@/lib/utils';

interface PasswordStrengthProps {
  password: string;
  showRequirements?: boolean;
  className?: string;
}

// 强度级别 - only styles, labels will be translated
const strengthLevelConfigs = [
  {
    labelKey: 'veryWeak',
    color: 'bg-red-500 dark:bg-red-400',
    textColor: 'text-red-600 dark:text-red-400',
    min: 0,
  },
  {
    labelKey: 'weak',
    color: 'bg-orange-500 dark:bg-orange-400',
    textColor: 'text-orange-600 dark:text-orange-400',
    min: 2,
  },
  {
    labelKey: 'fair',
    color: 'bg-yellow-500 dark:bg-yellow-400',
    textColor: 'text-yellow-600 dark:text-yellow-400',
    min: 4,
  },
  {
    labelKey: 'strong',
    color: 'bg-green-500 dark:bg-green-400',
    textColor: 'text-green-600 dark:text-green-400',
    min: 6,
  },
  {
    labelKey: 'veryStrong',
    color: 'bg-emerald-500 dark:bg-emerald-400',
    textColor: 'text-emerald-600 dark:text-emerald-400',
    min: 7,
  },
];

const needsAttentionConfig = {
  labelKey: 'almostThere',
  color: 'bg-amber-500 dark:bg-amber-400',
  textColor: 'text-amber-700 dark:text-amber-300',
};

export function PasswordStrength({
  password,
  showRequirements = true,
  className,
}: PasswordStrengthProps) {
  const t = useTranslations('ui.password');

  // 计算满足的要求数量
  const { passedCount, passed, missingAllowedSpecial, unsupportedChars } = useMemo(() => {
    const results = getPasswordPolicyChecks(password);
    const invalidChars = getUnsupportedPasswordChars(password);
    return {
      passedCount: getPasswordPolicyScore(password),
      passed: results,
      missingAllowedSpecial: !results.find((req) => req.id === 'special')?.passed,
      unsupportedChars: invalidChars.join(' '),
    };
  }, [password]);
  const policyCompliant = useMemo(() => isPasswordCompliant(password), [password]);

  // 获取强度级别
  const strengthLevelIndex = useMemo(() => {
    const levelIndex = strengthLevelConfigs.findLastIndex((level) => passedCount >= level.min);
    return levelIndex >= 0 ? levelIndex : 0;
  }, [passedCount]);

  const { strength, displayLevelIndex } = useMemo(() => {
    const baseStrength = strengthLevelConfigs[strengthLevelIndex] || strengthLevelConfigs[0];
    if (!policyCompliant && passedCount >= 5) {
      return {
        strength: needsAttentionConfig,
        displayLevelIndex: Math.min(strengthLevelIndex, 3),
      };
    }

    return {
      strength: baseStrength,
      displayLevelIndex: strengthLevelIndex,
    };
  }, [passedCount, policyCompliant, strengthLevelIndex]);

  if (!password) return null;

  return (
    <div className={cn('space-y-3', className)}>
      {/* 强度指示条 */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{t('strength')}</span>
          <span className={cn('text-xs font-medium', strength.textColor)}>
            {t(strength.labelKey)}
          </span>
        </div>
        <div className="flex gap-1">
          {strengthLevelConfigs.map((level, index) => (
            <div
              key={level.labelKey}
              className={cn(
                'h-1.5 flex-1 rounded-full transition-colors duration-200',
                index <= displayLevelIndex ? strength.color : 'bg-muted'
              )}
            />
          ))}
        </div>
      </div>

      {/* 要求列表 */}
      {showRequirements && (
        <>
          {(missingAllowedSpecial || unsupportedChars) && (
            <div className="flex gap-2.5 rounded-lg border-2 border-destructive/60 bg-destructive/15 px-3.5 py-3 text-sm text-destructive shadow-sm">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="space-y-1">
                <p className="font-semibold">
                  {unsupportedChars
                    ? t('unsupportedSpecialTitle', { chars: unsupportedChars })
                    : t('missingSpecialTitle')}
                </p>
                <p>{t('allowedSpecialHint', { chars: PASSWORD_POLICY.allowedSpecialChars })}</p>
              </div>
            </div>
          )}

          <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {passed.map((req) => (
              <li
                key={req.id}
                className={cn(
                  'flex items-center gap-1.5 text-xs transition-colors',
                  req.passed ? 'text-success' : 'text-destructive'
                )}
              >
                {req.passed ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                {t(req.id)}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export function isPasswordValid(password: string): boolean {
  return isPasswordCompliant(password);
}

// 辅助函数：获取密码策略通过项数量
export function getPasswordScore(password: string): number {
  return getPasswordPolicyScore(password);
}
