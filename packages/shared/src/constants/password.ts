export const PASSWORD_POLICY = {
  minLength: 8,
  maxLength: 32,
  allowedSpecialChars: '@$!%*#?&',
  allowedCharacterPattern: /^[A-Za-z\d@$!%*#?&]+$/,
  allowedCharacterPatternPartial: /^[A-Za-z\d@$!%*#?&]*$/,
  requiredPattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,32}$/,
} as const;

export const PASSWORD_POLICY_MESSAGE_ZH = `密码需包含大小写字母、数字，并使用 ${PASSWORD_POLICY.allowedSpecialChars} 中的一个特殊字符`;
export const PASSWORD_POLICY_MESSAGE_EN = `Password must include uppercase, lowercase, a number, and one special character from ${PASSWORD_POLICY.allowedSpecialChars}`;

export const PASSWORD_REQUIREMENT_IDS = [
  'length',
  'maxLength',
  'lowercase',
  'uppercase',
  'number',
  'special',
  'allowedChars',
] as const;

export type PasswordRequirementId = (typeof PASSWORD_REQUIREMENT_IDS)[number];

export type PasswordPolicyCheck = {
  id: PasswordRequirementId;
  passed: boolean;
};

export function getUnsupportedPasswordChars(password: string): string[] {
  const unsupportedChars = Array.from(password).filter(
    (char) => !PASSWORD_POLICY.allowedCharacterPatternPartial.test(char)
  );

  return Array.from(new Set(unsupportedChars));
}

export function getPasswordPolicyChecks(password: string): PasswordPolicyCheck[] {
  return [
    { id: 'length', passed: password.length >= PASSWORD_POLICY.minLength },
    { id: 'maxLength', passed: password.length <= PASSWORD_POLICY.maxLength },
    { id: 'lowercase', passed: /[a-z]/.test(password) },
    { id: 'uppercase', passed: /[A-Z]/.test(password) },
    { id: 'number', passed: /\d/.test(password) },
    { id: 'special', passed: /[@$!%*#?&]/.test(password) },
    {
      id: 'allowedChars',
      passed: PASSWORD_POLICY.allowedCharacterPatternPartial.test(password),
    },
  ];
}

export function isPasswordCompliant(password: string): boolean {
  return PASSWORD_POLICY.requiredPattern.test(password);
}

export function getPasswordPolicyScore(password: string): number {
  return getPasswordPolicyChecks(password).filter((check) => check.passed).length;
}
