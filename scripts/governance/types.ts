/**
 * Governance rule types — single source of truth for rule IDs and issue shape.
 */

export type GovernanceRuleId =
  | 'optional-security'
  | 'nl-endpoint-coverage'
  | 'config-consistency'
  | 'user-data-isolation'
  | 'dead-provider'
  | 'sensitive-endpoint-throttle'
  | 'controller-auth-coverage'
  | 'dto-validation-completeness'
  | 'i18n-key-balance'
  | 'page-loading-coverage'
  | 'api-route-shared-constants'
  | 'validation-i18n-keys'
  | 'flex-overflow-safety'
  | 'component-size-limit'
  | 'service-size-limit'
  | 'error-boundary-coverage';

export interface GovernanceIssue {
  rule: GovernanceRuleId;
  severity: 'error' | 'warning' | 'info';
  message: string;
  file?: string;
  line?: number;
}

export interface GovernanceResult {
  issues: GovernanceIssue[];
  summary: { errors: number; warnings: number; infos: number };
}

export type GovernanceRule = {
  id: GovernanceRuleId;
  run: () => GovernanceIssue[];
};
