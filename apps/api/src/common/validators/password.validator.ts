import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

export interface PasswordStrengthOptions {
  minLength?: number;
  maxLength?: number;
  requireUppercase?: boolean;
  requireLowercase?: boolean;
  requireNumbers?: boolean;
  requireSpecialChars?: boolean;
}

const defaultOptions: PasswordStrengthOptions = {
  minLength: 8,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: false, // 可选，对用户更友好
};

/**
 * 密码强度验证装饰器
 */
export function IsStrongPassword(
  options?: PasswordStrengthOptions,
  validationOptions?: ValidationOptions,
) {
  const opts = { ...defaultOptions, ...options };

  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isStrongPassword',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (typeof value !== 'string') return false;

          const errors: string[] = [];

          if (opts.minLength && value.length < opts.minLength) {
            errors.push(`至少 ${opts.minLength} 个字符`);
          }

          if (opts.maxLength && value.length > opts.maxLength) {
            errors.push(`最多 ${opts.maxLength} 个字符`);
          }

          if (opts.requireUppercase && !/[A-Z]/.test(value)) {
            errors.push('包含大写字母');
          }

          if (opts.requireLowercase && !/[a-z]/.test(value)) {
            errors.push('包含小写字母');
          }

          if (opts.requireNumbers && !/\d/.test(value)) {
            errors.push('包含数字');
          }

          if (opts.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(value)) {
            errors.push('包含特殊字符');
          }

          // 检查常见弱密码
          const weakPasswords = [
            'password',
            '12345678',
            'qwerty123',
            'abc12345',
            'password123',
          ];
          if (weakPasswords.includes(value.toLowerCase())) {
            errors.push('不能使用常见弱密码');
          }

          return errors.length === 0;
        },
        defaultMessage(args: ValidationArguments) {
          const value = args.value as string;
          const errors: string[] = [];

          if (opts.minLength && (!value || value.length < opts.minLength)) {
            errors.push(`至少 ${opts.minLength} 个字符`);
          }

          if (opts.requireUppercase && !/[A-Z]/.test(value || '')) {
            errors.push('包含大写字母');
          }

          if (opts.requireLowercase && !/[a-z]/.test(value || '')) {
            errors.push('包含小写字母');
          }

          if (opts.requireNumbers && !/\d/.test(value || '')) {
            errors.push('包含数字');
          }

          if (opts.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(value || '')) {
            errors.push('包含特殊字符');
          }

          return `密码强度不足，需要：${errors.join('、')}`;
        },
      },
    });
  };
}

/**
 * 计算密码强度分数 (0-100)
 */
export function calculatePasswordStrength(password: string): {
  score: number;
  level: 'weak' | 'fair' | 'good' | 'strong';
  feedback: string[];
} {
  let score = 0;
  const feedback: string[] = [];

  if (!password) {
    return { score: 0, level: 'weak', feedback: ['请输入密码'] };
  }

  // 长度得分 (最多 30 分)
  score += Math.min(password.length * 3, 30);

  // 大写字母 (10 分)
  if (/[A-Z]/.test(password)) {
    score += 10;
  } else {
    feedback.push('添加大写字母');
  }

  // 小写字母 (10 分)
  if (/[a-z]/.test(password)) {
    score += 10;
  } else {
    feedback.push('添加小写字母');
  }

  // 数字 (10 分)
  if (/\d/.test(password)) {
    score += 10;
  } else {
    feedback.push('添加数字');
  }

  // 特殊字符 (15 分)
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    score += 15;
  } else {
    feedback.push('添加特殊字符会更安全');
  }

  // 字符多样性 (15 分)
  const uniqueChars = new Set(password).size;
  score += Math.min(uniqueChars * 1.5, 15);

  // 连续字符惩罚
  if (/(.)\1{2,}/.test(password)) {
    score -= 10;
    feedback.push('避免连续重复字符');
  }

  // 常见模式惩罚
  const commonPatterns = ['123', 'abc', 'qwe', 'password'];
  for (const pattern of commonPatterns) {
    if (password.toLowerCase().includes(pattern)) {
      score -= 15;
      feedback.push('避免常见密码模式');
      break;
    }
  }

  score = Math.max(0, Math.min(100, score));

  let level: 'weak' | 'fair' | 'good' | 'strong';
  if (score < 30) level = 'weak';
  else if (score < 50) level = 'fair';
  else if (score < 70) level = 'good';
  else level = 'strong';

  return { score, level, feedback };
}








