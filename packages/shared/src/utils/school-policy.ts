import type { SchoolTestingPolicy } from '../types/prediction';

type TestingPolicyInput = {
  testingPolicy?: SchoolTestingPolicy | null;
  testOptional?: boolean | null;
};

const VALID_POLICIES: SchoolTestingPolicy[] = ['REQUIRED', 'OPTIONAL', 'BLIND', 'UNKNOWN'];

export function isSchoolTestingPolicy(value: unknown): value is SchoolTestingPolicy {
  return typeof value === 'string' && VALID_POLICIES.includes(value as SchoolTestingPolicy);
}

export function resolveSchoolTestingPolicyValue(input: TestingPolicyInput): SchoolTestingPolicy {
  // Preserve explicit testingPolicy (including UNKNOWN) — gold case 007
  // ("Unknown school policy should remain explicit instead of being inferred
  // into a false optional/required label") regresses if we infer over an
  // explicit UNKNOWN. testOptional inference only fires when no explicit
  // testingPolicy was supplied.
  if (isSchoolTestingPolicy(input.testingPolicy)) {
    return input.testingPolicy;
  }
  if (input.testOptional === true) return 'OPTIONAL';
  if (input.testOptional === false) return 'REQUIRED';
  return 'UNKNOWN';
}

export function toLegacyTestOptionalFlag(input: TestingPolicyInput): boolean | undefined {
  const policy = resolveSchoolTestingPolicyValue(input);
  if (policy === 'OPTIONAL') return true;
  if (policy === 'REQUIRED') return false;
  if (policy === 'BLIND') return false;
  if (input.testOptional != null) return input.testOptional;
  return undefined;
}

export function matchesLegacyTestOptionalFilter(input: TestingPolicyInput): boolean {
  const policy = resolveSchoolTestingPolicyValue(input);
  if (policy !== 'UNKNOWN') {
    return policy === 'OPTIONAL';
  }
  return input.testOptional === true;
}
