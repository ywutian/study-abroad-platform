import type {
  OwnedSiteAssessmentManifest,
  OwnedSiteAssessmentTarget,
  OwnedSiteJourneyDefinition,
  OwnedSitePrivilegeTransition,
  OwnedSiteRole,
} from '@study-abroad/shared';
import { z } from 'zod';

const ownedSiteKeySchema = z.enum([
  'collegevine',
  'campusreel',
  'niche',
  'parchment',
  'college-raptor',
  'appily',
  'prepscholar',
]);

const ownedSiteRoleSchema = z.enum([
  'guest',
  'registered_consumer',
  'profiled_consumer',
  'paid_consumer',
  'collaborator',
  'institution_staff',
  'admin_ops',
]);

const ownedSiteEnvironmentSchema = z.enum(['prod', 'staging']);

const mutationBudgetSchema = z.enum([
  'read-only',
  'reversible-write',
  'dangerous-write',
]);

const journeyCategorySchema = z.enum([
  'discovery',
  'profile',
  'chances',
  'saved_list',
  'messaging',
  'billing',
  'institution',
  'admin',
]);

const journeyDefinitionSchema: z.ZodType<OwnedSiteJourneyDefinition> = z.object(
  {
    journeyId: z.string().min(1),
    siteKey: ownedSiteKeySchema,
    label: z.string().min(1),
    category: journeyCategorySchema,
    entryUrl: z.string().min(1),
    requiresAuth: z.boolean(),
    defaultMutationBudget: mutationBudgetSchema,
    desktopPriority: z.number().int().min(1).max(100),
    notes: z.array(z.string()).optional(),
  },
);

const targetSchema: z.ZodType<OwnedSiteAssessmentTarget> = z.object({
  targetId: z.string().min(1),
  siteKey: ownedSiteKeySchema,
  environment: ownedSiteEnvironmentSchema,
  role: ownedSiteRoleSchema,
  siteRole: z.string().min(1).optional(),
  loginUrl: z.string().min(1),
  homeUrl: z.string().min(1),
  journeys: z.array(z.string().min(1)).min(1),
  mutationBudget: mutationBudgetSchema,
  accountLabel: z.string().min(1),
  accountOwner: z.string().min(1),
});

const privilegeTransitionSchema: z.ZodType<OwnedSitePrivilegeTransition> =
  z.object({
    transitionId: z.string().min(1),
    siteKey: ownedSiteKeySchema,
    environment: z.union([ownedSiteEnvironmentSchema, z.literal('any')]),
    fromRole: ownedSiteRoleSchema,
    fromSiteRole: z.string().min(1).optional(),
    toRole: ownedSiteRoleSchema,
    toSiteRole: z.string().min(1).optional(),
    transitionLabel: z.string().min(1),
    transitionUrl: z.string().min(1).optional(),
    notes: z.array(z.string()).optional(),
  });

const manifestSchema: z.ZodType<OwnedSiteAssessmentManifest> = z.object({
  version: z.number().int().min(1),
  generatedFrom: z.string().optional(),
  notes: z.array(z.string()).optional(),
  journeyCatalog: z.array(journeyDefinitionSchema).min(1),
  targets: z.array(targetSchema).min(1),
  privilegeTransitions: z.array(privilegeTransitionSchema),
});

function resolveTemplateString(
  value: string,
  env: NodeJS.ProcessEnv,
): { value: string; unresolvedEnvVars: string[] } {
  const unresolvedEnvVars: string[] = [];
  const resolved = value.replace(
    /\$\{([A-Z0-9_]+)\}/g,
    (_match, envKey: string) => {
      const replacement = env[envKey];
      if (replacement == null || replacement === '') {
        unresolvedEnvVars.push(envKey);
        return `\${${envKey}}`;
      }
      return replacement;
    },
  );

  return { value: resolved, unresolvedEnvVars };
}

function resolveTemplatesDeep<T>(
  value: T,
  env: NodeJS.ProcessEnv,
  unresolvedEnvVars: Set<string>,
): T {
  if (typeof value === 'string') {
    const resolved = resolveTemplateString(value, env);
    for (const envKey of resolved.unresolvedEnvVars) {
      unresolvedEnvVars.add(envKey);
    }
    return resolved.value as T;
  }

  if (Array.isArray(value)) {
    return (value as unknown[]).map((item) =>
      resolveTemplatesDeep(item, env, unresolvedEnvVars),
    ) as T;
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).map(
      ([key, item]) => [
        key,
        resolveTemplatesDeep(item, env, unresolvedEnvVars),
      ],
    );
    return Object.fromEntries(entries) as T;
  }

  return value;
}

export function parseOwnedSiteAssessmentManifest(
  raw: unknown,
): OwnedSiteAssessmentManifest {
  return manifestSchema.parse(raw);
}

export function resolveOwnedSiteAssessmentManifestTemplates(
  manifest: OwnedSiteAssessmentManifest,
  env: NodeJS.ProcessEnv = process.env,
): {
  manifest: OwnedSiteAssessmentManifest;
  unresolvedEnvVars: string[];
} {
  const unresolvedEnvVars = new Set<string>();
  const resolvedManifest = resolveTemplatesDeep(
    manifest,
    env,
    unresolvedEnvVars,
  );
  return {
    manifest: parseOwnedSiteAssessmentManifest(resolvedManifest),
    unresolvedEnvVars: Array.from(unresolvedEnvVars).sort(),
  };
}

export function filterOwnedSiteAssessmentTargets(
  manifest: OwnedSiteAssessmentManifest,
  input?: {
    siteKeys?: string[];
    environments?: string[];
    roles?: string[];
  },
): OwnedSiteAssessmentTarget[] {
  const siteKeys = new Set(input?.siteKeys ?? []);
  const environments = new Set(input?.environments ?? []);
  const roles = new Set(input?.roles ?? []);

  return manifest.targets.filter((target) => {
    if (siteKeys.size > 0 && !siteKeys.has(target.siteKey)) return false;
    if (environments.size > 0 && !environments.has(target.environment)) {
      return false;
    }
    if (roles.size > 0 && !roles.has(target.role)) return false;
    return true;
  });
}

export function getJourneyCatalogMap(
  manifest: OwnedSiteAssessmentManifest,
): Map<string, OwnedSiteJourneyDefinition> {
  return new Map(
    manifest.journeyCatalog.map((journey) => [journey.journeyId, journey]),
  );
}

export function validateOwnedSiteAssessmentTargetJourneys(
  manifest: OwnedSiteAssessmentManifest,
): string[] {
  const journeyIds = new Set(
    manifest.journeyCatalog.map((journey) => journey.journeyId),
  );
  const errors: string[] = [];

  for (const target of manifest.targets) {
    for (const journeyId of target.journeys) {
      if (!journeyIds.has(journeyId)) {
        errors.push(
          `Target ${target.targetId} references unknown journeyId ${journeyId}.`,
        );
      }
    }
  }

  return errors;
}

export function defaultTargetSessionPath(
  target: Pick<
    OwnedSiteAssessmentTarget,
    'siteKey' | 'environment' | 'role' | 'siteRole'
  >,
  secretsDir: string,
): string {
  const parts = [
    target.siteKey,
    target.environment,
    target.role,
    target.siteRole,
  ].filter(Boolean);
  return `${secretsDir}/${parts.join('.')}.storageState.json`;
}

export function containsUnresolvedTemplate(value: string): boolean {
  return /\$\{[A-Z0-9_]+\}/.test(value);
}

export function isHighPrivilegeRole(
  role: OwnedSiteRole,
  siteRole?: string,
): boolean {
  return (
    role === 'institution_staff' ||
    role === 'admin_ops' ||
    siteRole === 'counselor_admin'
  );
}

export function inferTargetStatusFromObservations(input: {
  observationsCount: number;
  expectedJourneys: number;
  missingSession: boolean;
  unresolvedConfig: boolean;
}): 'complete' | 'partial' | 'missing-session' | 'pending-config' {
  if (input.unresolvedConfig) return 'pending-config';
  if (input.missingSession) return 'missing-session';
  if (input.observationsCount >= input.expectedJourneys) return 'complete';
  return 'partial';
}
