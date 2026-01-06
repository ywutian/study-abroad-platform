'use client';

import { useMemo } from 'react';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PasswordStrengthProps {
  password: string;
  showRequirements?: boolean;
  className?: string;
}

// 密码要求
const requirements = [
  { id: 'length', label: '至少8个字符', test: (p: string) => p.length >= 8 },
  { id: 'lowercase', label: '包含小写字母', test: (p: string) => /[a-z]/.test(p) },
  { id: 'uppercase', label: '包含大写字母', test: (p: string) => /[A-Z]/.test(p) },
  { id: 'number', label: '包含数字', test: (p: string) => /\d/.test(p) },
  { id: 'special', label: '包含特殊字符', test: (p: string) => /[!@#$%^&*(),.?":{}|<>]/.test(p) },
];

// 强度级别
const strengthLevels = [
  { label: '非常弱', color: 'bg-red-500', textColor: 'text-red-500', min: 0 },
  { label: '弱', color: 'bg-orange-500', textColor: 'text-orange-500', min: 1 },
  { label: '一般', color: 'bg-yellow-500', textColor: 'text-yellow-500', min: 2 },
  { label: '强', color: 'bg-green-500', textColor: 'text-green-500', min: 3 },
  { label: '非常强', color: 'bg-emerald-500', textColor: 'text-emerald-500', min: 4 },
];

export function PasswordStrength({ 
  password, 
  showRequirements = true,
  className,
}: PasswordStrengthProps) {
  // 计算满足的要求数量
  const { passedCount, passed } = useMemo(() => {
    const results = requirements.map(req => ({
      ...req,
      passed: req.test(password),
    }));
    return {
      passedCount: results.filter(r => r.passed).length,
      passed: results,
    };
  }, [password]);

  // 获取强度级别
  const strength = useMemo(() => {
    const levelIndex = strengthLevels.findLastIndex(level => passedCount >= level.min);
    return strengthLevels[levelIndex] || strengthLevels[0];
  }, [passedCount]);

  if (!password) return null;

  return (
    <div className={cn('space-y-3', className)}>
      {/* 强度指示条 */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">密码强度</span>
          <span className={cn('text-xs font-medium', strength.textColor)}>
            {strength.label}
          </span>
        </div>
        <div className="flex gap-1">
          {strengthLevels.map((level, index) => (
            <div
              key={level.label}
              className={cn(
                'h-1.5 flex-1 rounded-full transition-colors duration-200',
                index < passedCount ? strength.color : 'bg-muted'
              )}
            />
          ))}
        </div>
      </div>

      {/* 要求列表 */}
      {showRequirements && (
        <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {passed.map((req) => (
            <li
              key={req.id}
              className={cn(
                'flex items-center gap-1.5 text-xs transition-colors',
                req.passed ? 'text-success' : 'text-muted-foreground'
              )}
            >
              {req.passed ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <X className="w-3.5 h-3.5" />
              )}
              {req.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// 辅助函数：检查密码是否满足最低要求
export function isPasswordValid(password: string): boolean {
  // 最低要求：长度+字母+数字
  return (
    password.length >= 8 &&
    /[a-zA-Z]/.test(password) &&
    /\d/.test(password)
  );
}

// 辅助函数：获取密码强度分数 (0-5)
export function getPasswordScore(password: string): number {
  return requirements.filter(req => req.test(password)).length;
}



