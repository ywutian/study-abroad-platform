import type {
  OwnedSiteAssessmentManifest,
  OwnedSiteAssessmentTarget,
  OwnedSiteEnvironment,
  OwnedSiteJourneyCategory,
  OwnedSiteJourneyDefinition,
  OwnedSiteKey,
  OwnedSiteMutationBudget,
  OwnedSitePrivilegeTransition,
  OwnedSiteRole,
} from '@study-abroad/shared';

type JourneySpec = {
  key: string;
  label: string;
  category: OwnedSiteJourneyCategory;
  requiresAuth: boolean;
  defaultMutationBudget: OwnedSiteMutationBudget;
  desktopPriority: number;
  prodEntryUrl: string;
  stagingEntryUrl?: string;
  notes?: string[];
};

type RoleSpec = {
  role: OwnedSiteRole;
  siteRole?: string;
  journeys: string[];
  prodLoginUrl?: string;
  prodHomeUrl?: string;
  stagingLoginUrl?: string;
  stagingHomeUrl?: string;
  prodMutationBudget?: OwnedSiteMutationBudget;
  stagingMutationBudget?: OwnedSiteMutationBudget;
};

type SiteSpec = {
  siteKey: OwnedSiteKey;
  displayName: string;
  prodPublicHomeUrl: string;
  prodDefaultLoginUrl?: string;
  stagingBaseEnvVar: string;
  journeys: JourneySpec[];
  roles: RoleSpec[];
};

function toEnvPrefix(siteKey: OwnedSiteKey): string {
  return siteKey.replace(/-/g, '_').toUpperCase();
}

function placeholderUrl(
  siteKey: OwnedSiteKey,
  environment: OwnedSiteEnvironment,
  name: string,
): string {
  return `\${${toEnvPrefix(siteKey)}_${environment.toUpperCase()}_${name}}`;
}

function stagingBase(siteKey: OwnedSiteKey): string {
  return `\${${toEnvPrefix(siteKey)}_STAGING_BASE_URL}`;
}

function stagingUrl(siteKey: OwnedSiteKey, path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${stagingBase(siteKey)}${normalizedPath}`;
}

function defaultHomeUrl(
  site: SiteSpec,
  role: RoleSpec,
  environment: OwnedSiteEnvironment,
): string {
  if (environment === 'prod') {
    return role.prodHomeUrl ?? site.prodPublicHomeUrl;
  }
  return role.stagingHomeUrl ?? stagingBase(site.siteKey);
}

function defaultLoginUrl(
  site: SiteSpec,
  role: RoleSpec,
  environment: OwnedSiteEnvironment,
): string {
  if (environment === 'prod') {
    return (
      role.prodLoginUrl ?? site.prodDefaultLoginUrl ?? site.prodPublicHomeUrl
    );
  }
  return role.stagingLoginUrl ?? stagingUrl(site.siteKey, '/login');
}

function targetIdFor(
  siteKey: OwnedSiteKey,
  environment: OwnedSiteEnvironment,
  role: OwnedSiteRole,
  siteRole?: string,
): string {
  return [siteKey, environment, role, siteRole].filter(Boolean).join('.');
}

function accountLabelFor(
  siteKey: OwnedSiteKey,
  environment: OwnedSiteEnvironment,
  role: OwnedSiteRole,
  siteRole?: string,
): string {
  return [siteKey, environment, role, siteRole].filter(Boolean).join('-');
}

function buildJourneyDefinitions(site: SiteSpec): OwnedSiteJourneyDefinition[] {
  return (['prod', 'staging'] as OwnedSiteEnvironment[]).flatMap(
    (environment) =>
      site.journeys.map((journey): OwnedSiteJourneyDefinition => ({
        journeyId: `${site.siteKey}.${environment}.${journey.key}`,
        siteKey: site.siteKey,
        label:
          environment === 'prod'
            ? `${site.displayName} ${journey.label}`
            : `${site.displayName} ${journey.label} (Staging)`,
        category: journey.category,
        entryUrl:
          environment === 'prod'
            ? journey.prodEntryUrl
            : (journey.stagingEntryUrl ??
              stagingUrl(site.siteKey, `/${journey.key}`)),
        requiresAuth: journey.requiresAuth,
        defaultMutationBudget: journey.defaultMutationBudget,
        desktopPriority: journey.desktopPriority,
        notes: journey.notes,
      })),
  );
}

function buildTargets(site: SiteSpec): OwnedSiteAssessmentTarget[] {
  return (['prod', 'staging'] as OwnedSiteEnvironment[]).flatMap(
    (environment) =>
      site.roles.map((role): OwnedSiteAssessmentTarget => ({
        targetId: targetIdFor(
          site.siteKey,
          environment,
          role.role,
          role.siteRole,
        ),
        siteKey: site.siteKey,
        environment,
        role: role.role,
        siteRole: role.siteRole,
        loginUrl: defaultLoginUrl(site, role, environment),
        homeUrl: defaultHomeUrl(site, role, environment),
        journeys: role.journeys.map(
          (journeyKey) => `${site.siteKey}.${environment}.${journeyKey}`,
        ),
        mutationBudget:
          environment === 'prod'
            ? (role.prodMutationBudget ??
              (role.role === 'guest' ? 'read-only' : 'reversible-write'))
            : (role.stagingMutationBudget ??
              (role.role === 'guest' ? 'read-only' : 'dangerous-write')),
        accountLabel: accountLabelFor(
          site.siteKey,
          environment,
          role.role,
          role.siteRole,
        ),
        accountOwner: 'owned-site-assessment',
      })),
  );
}

function buildTransitions(site: SiteSpec): OwnedSitePrivilegeTransition[] {
  const roles = new Set(
    site.roles.map((role) => `${role.role}:${role.siteRole ?? ''}`),
  );
  const transitions: OwnedSitePrivilegeTransition[] = [];

  function has(role: OwnedSiteRole, siteRole?: string): boolean {
    return roles.has(`${role}:${siteRole ?? ''}`);
  }

  if (has('guest') && has('registered_consumer')) {
    transitions.push({
      transitionId: `${site.siteKey}.guest-to-registered`,
      siteKey: site.siteKey,
      environment: 'any',
      fromRole: 'guest',
      toRole: 'registered_consumer',
      transitionLabel: 'Guest registration or sign-up',
      transitionUrl: site.prodDefaultLoginUrl ?? site.prodPublicHomeUrl,
    });
  }

  if (has('registered_consumer') && has('profiled_consumer')) {
    transitions.push({
      transitionId: `${site.siteKey}.registered-to-profiled`,
      siteKey: site.siteKey,
      environment: 'any',
      fromRole: 'registered_consumer',
      toRole: 'profiled_consumer',
      transitionLabel: 'Profile completion unlocks core matching or chances',
    });
  }

  if (has('profiled_consumer') && has('paid_consumer')) {
    transitions.push({
      transitionId: `${site.siteKey}.profiled-to-paid`,
      siteKey: site.siteKey,
      environment: 'any',
      fromRole: 'profiled_consumer',
      toRole: 'paid_consumer',
      transitionLabel: 'Premium upgrade or paid entitlement gate',
    });
  }

  if (has('guest') && has('collaborator')) {
    transitions.push({
      transitionId: `${site.siteKey}.guest-to-collaborator`,
      siteKey: site.siteKey,
      environment: 'any',
      fromRole: 'guest',
      toRole: 'collaborator',
      transitionLabel: 'Counselor or collaborator onboarding',
    });
  }

  if (has('guest') && has('institution_staff')) {
    transitions.push({
      transitionId: `${site.siteKey}.guest-to-institution`,
      siteKey: site.siteKey,
      environment: 'any',
      fromRole: 'guest',
      toRole: 'institution_staff',
      transitionLabel: 'Claim school, verify profile, or partner onboarding',
    });
  }

  if (has('institution_staff') && has('admin_ops')) {
    transitions.push({
      transitionId: `${site.siteKey}.institution-to-admin`,
      siteKey: site.siteKey,
      environment: 'any',
      fromRole: 'institution_staff',
      toRole: 'admin_ops',
      transitionLabel: 'Internal operator or elevated admin invite',
    });
  }

  if (
    site.siteKey === 'college-raptor' &&
    has('collaborator', 'counselor') &&
    has('collaborator', 'counselor_admin')
  ) {
    transitions.push({
      transitionId: 'college-raptor.counselor-to-counselor-admin',
      siteKey: 'college-raptor',
      environment: 'any',
      fromRole: 'collaborator',
      fromSiteRole: 'counselor',
      toRole: 'collaborator',
      toSiteRole: 'counselor_admin',
      transitionLabel: 'Counselor admin promotion',
    });
  }

  return transitions;
}

const SITE_SPECS: SiteSpec[] = [
  {
    siteKey: 'collegevine',
    displayName: 'CollegeVine',
    prodPublicHomeUrl: 'https://www.collegevine.com/admissions-calculator/',
    prodDefaultLoginUrl: placeholderUrl('collegevine', 'prod', 'LOGIN_URL'),
    stagingBaseEnvVar: 'COLLEGEVINE_STAGING_BASE_URL',
    journeys: [
      {
        key: 'discovery',
        label: 'Discovery',
        category: 'discovery',
        requiresAuth: false,
        defaultMutationBudget: 'read-only',
        desktopPriority: 70,
        prodEntryUrl: 'https://www.collegevine.com/admissions-calculator/',
        stagingEntryUrl: stagingUrl('collegevine', '/admissions-calculator/'),
        notes: ['Public calculator entrypoint and school discovery surface.'],
      },
      {
        key: 'profile',
        label: 'Profile',
        category: 'profile',
        requiresAuth: true,
        defaultMutationBudget: 'reversible-write',
        desktopPriority: 85,
        prodEntryUrl: placeholderUrl('collegevine', 'prod', 'PROFILE_URL'),
        stagingEntryUrl: placeholderUrl(
          'collegevine',
          'staging',
          'PROFILE_URL',
        ),
      },
      {
        key: 'chances',
        label: 'Chances',
        category: 'chances',
        requiresAuth: true,
        defaultMutationBudget: 'read-only',
        desktopPriority: 98,
        prodEntryUrl: 'https://www.collegevine.com/admissions-calculator/',
        stagingEntryUrl: stagingUrl('collegevine', '/admissions-calculator/'),
        notes: [
          'Core personalized chance workflow once a profiled user is signed in.',
        ],
      },
      {
        key: 'saved-list',
        label: 'Saved List',
        category: 'saved_list',
        requiresAuth: true,
        defaultMutationBudget: 'reversible-write',
        desktopPriority: 82,
        prodEntryUrl: placeholderUrl('collegevine', 'prod', 'SAVED_LIST_URL'),
        stagingEntryUrl: placeholderUrl(
          'collegevine',
          'staging',
          'SAVED_LIST_URL',
        ),
      },
      {
        key: 'counselors',
        label: 'Counselor Surface',
        category: 'messaging',
        requiresAuth: false,
        defaultMutationBudget: 'read-only',
        desktopPriority: 72,
        prodEntryUrl: 'https://go.collegevine.com/counselors',
        stagingEntryUrl: placeholderUrl(
          'collegevine',
          'staging',
          'COUNSELORS_URL',
        ),
      },
      {
        key: 'institution',
        label: 'Institution Partner Surface',
        category: 'institution',
        requiresAuth: false,
        defaultMutationBudget: 'read-only',
        desktopPriority: 80,
        prodEntryUrl: 'https://www.collegevine.com/recruit/verify-profile',
        stagingEntryUrl: placeholderUrl(
          'collegevine',
          'staging',
          'INSTITUTION_URL',
        ),
      },
      {
        key: 'admin',
        label: 'Admin Surface',
        category: 'admin',
        requiresAuth: true,
        defaultMutationBudget: 'read-only',
        desktopPriority: 99,
        prodEntryUrl: placeholderUrl('collegevine', 'prod', 'ADMIN_URL'),
        stagingEntryUrl: placeholderUrl('collegevine', 'staging', 'ADMIN_URL'),
      },
    ],
    roles: [
      {
        role: 'guest',
        journeys: ['discovery', 'chances', 'institution'],
        prodHomeUrl: 'https://www.collegevine.com/admissions-calculator/',
      },
      {
        role: 'registered_consumer',
        journeys: ['profile', 'saved-list', 'chances'],
      },
      {
        role: 'profiled_consumer',
        journeys: ['profile', 'chances', 'saved-list'],
      },
      {
        role: 'collaborator',
        siteRole: 'counselor',
        journeys: ['counselors', 'profile'],
        prodHomeUrl: 'https://go.collegevine.com/counselors',
      },
      {
        role: 'institution_staff',
        journeys: ['institution'],
        prodHomeUrl: 'https://www.collegevine.com/recruit/verify-profile',
      },
      {
        role: 'admin_ops',
        journeys: ['admin', 'institution', 'chances'],
      },
    ],
  },
  {
    siteKey: 'campusreel',
    displayName: 'CampusReel',
    prodPublicHomeUrl: 'https://www.campusreel.org/',
    prodDefaultLoginUrl: 'https://www.campusreel.org/users/sign_in',
    stagingBaseEnvVar: 'CAMPUSREEL_STAGING_BASE_URL',
    journeys: [
      {
        key: 'discovery',
        label: 'Discovery',
        category: 'discovery',
        requiresAuth: false,
        defaultMutationBudget: 'read-only',
        desktopPriority: 68,
        prodEntryUrl: 'https://www.campusreel.org/',
        stagingEntryUrl: stagingUrl('campusreel', '/'),
      },
      {
        key: 'profile',
        label: 'Profile',
        category: 'profile',
        requiresAuth: true,
        defaultMutationBudget: 'reversible-write',
        desktopPriority: 84,
        prodEntryUrl: placeholderUrl('campusreel', 'prod', 'PROFILE_URL'),
        stagingEntryUrl: placeholderUrl('campusreel', 'staging', 'PROFILE_URL'),
      },
      {
        key: 'chances',
        label: 'Admissions Calculator',
        category: 'chances',
        requiresAuth: false,
        defaultMutationBudget: 'read-only',
        desktopPriority: 96,
        prodEntryUrl:
          'https://www.campusreel.org/college-acceptance-calculator',
        stagingEntryUrl: placeholderUrl('campusreel', 'staging', 'CHANCES_URL'),
      },
      {
        key: 'saved-list',
        label: 'Saved List',
        category: 'saved_list',
        requiresAuth: true,
        defaultMutationBudget: 'reversible-write',
        desktopPriority: 78,
        prodEntryUrl: placeholderUrl('campusreel', 'prod', 'SAVED_LIST_URL'),
        stagingEntryUrl: placeholderUrl(
          'campusreel',
          'staging',
          'SAVED_LIST_URL',
        ),
      },
      {
        key: 'content-creator',
        label: 'Content Creator',
        category: 'messaging',
        requiresAuth: false,
        defaultMutationBudget: 'reversible-write',
        desktopPriority: 75,
        prodEntryUrl: 'https://www.campusreel.org/content-creator-registration',
        stagingEntryUrl: placeholderUrl(
          'campusreel',
          'staging',
          'CONTENT_CREATOR_URL',
        ),
      },
      {
        key: 'institution',
        label: 'Institution Partner',
        category: 'institution',
        requiresAuth: false,
        defaultMutationBudget: 'read-only',
        desktopPriority: 83,
        prodEntryUrl:
          'https://www.campusreel.org/services/lead-generation-higher-education',
        stagingEntryUrl: placeholderUrl(
          'campusreel',
          'staging',
          'INSTITUTION_URL',
        ),
      },
      {
        key: 'admin',
        label: 'Admin Surface',
        category: 'admin',
        requiresAuth: true,
        defaultMutationBudget: 'read-only',
        desktopPriority: 99,
        prodEntryUrl: placeholderUrl('campusreel', 'prod', 'ADMIN_URL'),
        stagingEntryUrl: placeholderUrl('campusreel', 'staging', 'ADMIN_URL'),
      },
    ],
    roles: [
      { role: 'guest', journeys: ['discovery', 'chances', 'institution'] },
      { role: 'registered_consumer', journeys: ['profile', 'saved-list'] },
      {
        role: 'profiled_consumer',
        journeys: ['profile', 'chances', 'saved-list'],
      },
      {
        role: 'collaborator',
        siteRole: 'content_creator',
        journeys: ['content-creator', 'profile'],
        prodHomeUrl: 'https://www.campusreel.org/content-creator-registration',
      },
      {
        role: 'institution_staff',
        journeys: ['institution'],
        prodHomeUrl:
          'https://www.campusreel.org/services/lead-generation-higher-education',
      },
      { role: 'admin_ops', journeys: ['admin', 'institution'] },
    ],
  },
  {
    siteKey: 'niche',
    displayName: 'Niche',
    prodPublicHomeUrl: 'https://www.niche.com/colleges/admissions-calculator/',
    prodDefaultLoginUrl: placeholderUrl('niche', 'prod', 'LOGIN_URL'),
    stagingBaseEnvVar: 'NICHE_STAGING_BASE_URL',
    journeys: [
      {
        key: 'discovery',
        label: 'Discovery',
        category: 'discovery',
        requiresAuth: false,
        defaultMutationBudget: 'read-only',
        desktopPriority: 65,
        prodEntryUrl: 'https://www.niche.com/colleges/admissions-calculator/',
        stagingEntryUrl: stagingUrl(
          'niche',
          '/colleges/admissions-calculator/',
        ),
      },
      {
        key: 'profile',
        label: 'Profile',
        category: 'profile',
        requiresAuth: true,
        defaultMutationBudget: 'reversible-write',
        desktopPriority: 82,
        prodEntryUrl: placeholderUrl('niche', 'prod', 'PROFILE_URL'),
        stagingEntryUrl: placeholderUrl('niche', 'staging', 'PROFILE_URL'),
      },
      {
        key: 'chances',
        label: 'Admissions Calculator',
        category: 'chances',
        requiresAuth: false,
        defaultMutationBudget: 'read-only',
        desktopPriority: 95,
        prodEntryUrl: 'https://www.niche.com/colleges/admissions-calculator/',
        stagingEntryUrl: stagingUrl(
          'niche',
          '/colleges/admissions-calculator/',
        ),
      },
      {
        key: 'saved-list',
        label: 'Saved List',
        category: 'saved_list',
        requiresAuth: true,
        defaultMutationBudget: 'reversible-write',
        desktopPriority: 76,
        prodEntryUrl: placeholderUrl('niche', 'prod', 'SAVED_LIST_URL'),
        stagingEntryUrl: placeholderUrl('niche', 'staging', 'SAVED_LIST_URL'),
      },
      {
        key: 'institution',
        label: 'Institution Partner',
        category: 'institution',
        requiresAuth: false,
        defaultMutationBudget: 'read-only',
        desktopPriority: 81,
        prodEntryUrl: 'https://www.niche.com/claim-your-school/',
        stagingEntryUrl: placeholderUrl('niche', 'staging', 'INSTITUTION_URL'),
      },
      {
        key: 'premium-profile',
        label: 'Premium Profile',
        category: 'billing',
        requiresAuth: false,
        defaultMutationBudget: 'read-only',
        desktopPriority: 74,
        prodEntryUrl:
          'https://www.niche.com/about/niche-premium-profile-college/',
        stagingEntryUrl: placeholderUrl(
          'niche',
          'staging',
          'PREMIUM_PROFILE_URL',
        ),
      },
      {
        key: 'admin',
        label: 'Admin Surface',
        category: 'admin',
        requiresAuth: true,
        defaultMutationBudget: 'read-only',
        desktopPriority: 99,
        prodEntryUrl: placeholderUrl('niche', 'prod', 'ADMIN_URL'),
        stagingEntryUrl: placeholderUrl('niche', 'staging', 'ADMIN_URL'),
      },
    ],
    roles: [
      { role: 'guest', journeys: ['discovery', 'chances', 'institution'] },
      { role: 'registered_consumer', journeys: ['profile', 'saved-list'] },
      {
        role: 'profiled_consumer',
        journeys: ['profile', 'chances', 'saved-list'],
      },
      {
        role: 'institution_staff',
        journeys: ['institution', 'premium-profile'],
        prodHomeUrl: 'https://www.niche.com/claim-your-school/',
      },
      { role: 'admin_ops', journeys: ['admin', 'institution'] },
    ],
  },
  {
    siteKey: 'parchment',
    displayName: 'Parchment',
    prodPublicHomeUrl: 'https://www.parchment.com/c/my-chances/',
    prodDefaultLoginUrl: placeholderUrl('parchment', 'prod', 'LOGIN_URL'),
    stagingBaseEnvVar: 'PARCHMENT_STAGING_BASE_URL',
    journeys: [
      {
        key: 'discovery',
        label: 'Learner Discovery',
        category: 'discovery',
        requiresAuth: false,
        defaultMutationBudget: 'read-only',
        desktopPriority: 63,
        prodEntryUrl: 'https://www.parchment.com/markets/learners/',
        stagingEntryUrl: stagingUrl('parchment', '/markets/learners/'),
      },
      {
        key: 'profile',
        label: 'Profile',
        category: 'profile',
        requiresAuth: true,
        defaultMutationBudget: 'reversible-write',
        desktopPriority: 82,
        prodEntryUrl: placeholderUrl('parchment', 'prod', 'PROFILE_URL'),
        stagingEntryUrl: placeholderUrl('parchment', 'staging', 'PROFILE_URL'),
      },
      {
        key: 'chances',
        label: 'My Chances',
        category: 'chances',
        requiresAuth: false,
        defaultMutationBudget: 'read-only',
        desktopPriority: 96,
        prodEntryUrl: 'https://www.parchment.com/c/my-chances/',
        stagingEntryUrl: placeholderUrl('parchment', 'staging', 'CHANCES_URL'),
      },
      {
        key: 'saved-list',
        label: 'Saved List',
        category: 'saved_list',
        requiresAuth: true,
        defaultMutationBudget: 'reversible-write',
        desktopPriority: 72,
        prodEntryUrl: placeholderUrl('parchment', 'prod', 'SAVED_LIST_URL'),
        stagingEntryUrl: placeholderUrl(
          'parchment',
          'staging',
          'SAVED_LIST_URL',
        ),
      },
      {
        key: 'collaborator',
        label: 'Counselor / SENDedu',
        category: 'messaging',
        requiresAuth: false,
        defaultMutationBudget: 'read-only',
        desktopPriority: 77,
        prodEntryUrl:
          'https://www.parchment.com/platform/sendedu-powered-by-parchment/',
        stagingEntryUrl: placeholderUrl(
          'parchment',
          'staging',
          'COLLABORATOR_URL',
        ),
      },
      {
        key: 'institution',
        label: 'Institution Products',
        category: 'institution',
        requiresAuth: false,
        defaultMutationBudget: 'read-only',
        desktopPriority: 83,
        prodEntryUrl: 'https://www.parchment.com/products/',
        stagingEntryUrl: stagingUrl('parchment', '/products/'),
      },
      {
        key: 'admin',
        label: 'Admin Surface',
        category: 'admin',
        requiresAuth: true,
        defaultMutationBudget: 'read-only',
        desktopPriority: 99,
        prodEntryUrl: placeholderUrl('parchment', 'prod', 'ADMIN_URL'),
        stagingEntryUrl: placeholderUrl('parchment', 'staging', 'ADMIN_URL'),
      },
    ],
    roles: [
      { role: 'guest', journeys: ['discovery', 'chances', 'institution'] },
      { role: 'registered_consumer', journeys: ['profile', 'saved-list'] },
      {
        role: 'profiled_consumer',
        journeys: ['profile', 'chances', 'saved-list'],
      },
      {
        role: 'collaborator',
        siteRole: 'counselor',
        journeys: ['collaborator', 'profile'],
        prodHomeUrl:
          'https://www.parchment.com/platform/sendedu-powered-by-parchment/',
      },
      {
        role: 'institution_staff',
        journeys: ['institution', 'collaborator'],
        prodHomeUrl: 'https://www.parchment.com/products/',
      },
      { role: 'admin_ops', journeys: ['admin', 'institution'] },
    ],
  },
  {
    siteKey: 'college-raptor',
    displayName: 'College Raptor',
    prodPublicHomeUrl: 'https://www.collegeraptor.com/',
    prodDefaultLoginUrl: placeholderUrl('college-raptor', 'prod', 'LOGIN_URL'),
    stagingBaseEnvVar: 'COLLEGE_RAPTOR_STAGING_BASE_URL',
    journeys: [
      {
        key: 'discovery',
        label: 'Discovery',
        category: 'discovery',
        requiresAuth: false,
        defaultMutationBudget: 'read-only',
        desktopPriority: 62,
        prodEntryUrl: 'https://www.collegeraptor.com/',
        stagingEntryUrl: stagingUrl('college-raptor', '/'),
      },
      {
        key: 'profile',
        label: 'Account Guide',
        category: 'profile',
        requiresAuth: false,
        defaultMutationBudget: 'read-only',
        desktopPriority: 80,
        prodEntryUrl: 'https://www.collegeraptor.com/home/accountguide',
        stagingEntryUrl: placeholderUrl(
          'college-raptor',
          'staging',
          'PROFILE_URL',
        ),
      },
      {
        key: 'chances',
        label: 'Match / Chances',
        category: 'chances',
        requiresAuth: true,
        defaultMutationBudget: 'read-only',
        desktopPriority: 97,
        prodEntryUrl: placeholderUrl('college-raptor', 'prod', 'CHANCES_URL'),
        stagingEntryUrl: placeholderUrl(
          'college-raptor',
          'staging',
          'CHANCES_URL',
        ),
      },
      {
        key: 'saved-list',
        label: 'Saved List',
        category: 'saved_list',
        requiresAuth: true,
        defaultMutationBudget: 'reversible-write',
        desktopPriority: 77,
        prodEntryUrl: placeholderUrl(
          'college-raptor',
          'prod',
          'SAVED_LIST_URL',
        ),
        stagingEntryUrl: placeholderUrl(
          'college-raptor',
          'staging',
          'SAVED_LIST_URL',
        ),
      },
      {
        key: 'parents',
        label: 'Parent Surface',
        category: 'messaging',
        requiresAuth: false,
        defaultMutationBudget: 'read-only',
        desktopPriority: 74,
        prodEntryUrl: 'https://www.collegeraptor.com/Landing/Parents',
        stagingEntryUrl: placeholderUrl(
          'college-raptor',
          'staging',
          'PARENTS_URL',
        ),
      },
      {
        key: 'institution',
        label: 'Institution / Counselor Surface',
        category: 'institution',
        requiresAuth: false,
        defaultMutationBudget: 'read-only',
        desktopPriority: 82,
        prodEntryUrl: 'https://www.collegeraptor.com/Home/FAQ',
        stagingEntryUrl: placeholderUrl(
          'college-raptor',
          'staging',
          'INSTITUTION_URL',
        ),
      },
      {
        key: 'admin',
        label: 'Admin Surface',
        category: 'admin',
        requiresAuth: true,
        defaultMutationBudget: 'read-only',
        desktopPriority: 99,
        prodEntryUrl: placeholderUrl('college-raptor', 'prod', 'ADMIN_URL'),
        stagingEntryUrl: placeholderUrl(
          'college-raptor',
          'staging',
          'ADMIN_URL',
        ),
      },
    ],
    roles: [
      { role: 'guest', journeys: ['discovery', 'profile', 'institution'] },
      {
        role: 'registered_consumer',
        journeys: ['profile', 'saved-list'],
      },
      {
        role: 'profiled_consumer',
        siteRole: 'student',
        journeys: ['profile', 'chances', 'saved-list'],
      },
      {
        role: 'collaborator',
        siteRole: 'parent',
        journeys: ['parents', 'saved-list'],
        prodHomeUrl: 'https://www.collegeraptor.com/Landing/Parents',
      },
      {
        role: 'collaborator',
        siteRole: 'counselor',
        journeys: ['institution', 'profile'],
      },
      {
        role: 'collaborator',
        siteRole: 'counselor_admin',
        journeys: ['institution', 'admin'],
      },
      {
        role: 'institution_staff',
        journeys: ['institution'],
        prodHomeUrl: 'https://www.collegeraptor.com/Home/FAQ',
      },
      { role: 'admin_ops', journeys: ['admin', 'institution'] },
    ],
  },
  {
    siteKey: 'appily',
    displayName: 'Appily',
    prodPublicHomeUrl: 'https://www.appily.com/college-chances-calculator',
    prodDefaultLoginUrl: placeholderUrl('appily', 'prod', 'LOGIN_URL'),
    stagingBaseEnvVar: 'APPILY_STAGING_BASE_URL',
    journeys: [
      {
        key: 'discovery',
        label: 'Discovery',
        category: 'discovery',
        requiresAuth: false,
        defaultMutationBudget: 'read-only',
        desktopPriority: 64,
        prodEntryUrl: 'https://www.appily.com/about',
        stagingEntryUrl: stagingUrl('appily', '/about'),
      },
      {
        key: 'profile',
        label: 'Profile',
        category: 'profile',
        requiresAuth: true,
        defaultMutationBudget: 'reversible-write',
        desktopPriority: 82,
        prodEntryUrl: placeholderUrl('appily', 'prod', 'PROFILE_URL'),
        stagingEntryUrl: placeholderUrl('appily', 'staging', 'PROFILE_URL'),
      },
      {
        key: 'chances',
        label: 'College Chances Calculator',
        category: 'chances',
        requiresAuth: false,
        defaultMutationBudget: 'read-only',
        desktopPriority: 95,
        prodEntryUrl: 'https://www.appily.com/college-chances-calculator',
        stagingEntryUrl: stagingUrl('appily', '/college-chances-calculator'),
      },
      {
        key: 'match',
        label: 'Match',
        category: 'saved_list',
        requiresAuth: false,
        defaultMutationBudget: 'read-only',
        desktopPriority: 88,
        prodEntryUrl: 'https://www.appily.com/match',
        stagingEntryUrl: stagingUrl('appily', '/match'),
      },
      {
        key: 'direct-admissions',
        label: 'Direct Admissions',
        category: 'messaging',
        requiresAuth: false,
        defaultMutationBudget: 'reversible-write',
        desktopPriority: 84,
        prodEntryUrl: 'https://www.appily.com/direct-admissions',
        stagingEntryUrl: stagingUrl('appily', '/direct-admissions'),
      },
      {
        key: 'parents',
        label: 'Parent Surface',
        category: 'messaging',
        requiresAuth: false,
        defaultMutationBudget: 'read-only',
        desktopPriority: 73,
        prodEntryUrl: 'https://www.appily.com/guidance/parents',
        stagingEntryUrl: placeholderUrl('appily', 'staging', 'PARENTS_URL'),
      },
      {
        key: 'admin',
        label: 'Admin Surface',
        category: 'admin',
        requiresAuth: true,
        defaultMutationBudget: 'read-only',
        desktopPriority: 99,
        prodEntryUrl: placeholderUrl('appily', 'prod', 'ADMIN_URL'),
        stagingEntryUrl: placeholderUrl('appily', 'staging', 'ADMIN_URL'),
      },
    ],
    roles: [
      { role: 'guest', journeys: ['discovery', 'chances', 'match'] },
      { role: 'registered_consumer', journeys: ['profile', 'match'] },
      { role: 'profiled_consumer', journeys: ['profile', 'chances', 'match'] },
      {
        role: 'collaborator',
        siteRole: 'parent',
        journeys: ['parents', 'match'],
        prodHomeUrl: 'https://www.appily.com/guidance/parents',
      },
      {
        role: 'institution_staff',
        journeys: ['direct-admissions'],
        prodHomeUrl: 'https://www.appily.com/direct-admissions',
      },
      { role: 'admin_ops', journeys: ['admin', 'direct-admissions'] },
    ],
  },
  {
    siteKey: 'prepscholar',
    displayName: 'PrepScholar',
    prodPublicHomeUrl:
      'https://www.prepscholar.com/sat/s/colleges/Pitzer-College-admission-requirements',
    prodDefaultLoginUrl: placeholderUrl('prepscholar', 'prod', 'LOGIN_URL'),
    stagingBaseEnvVar: 'PREPSCHOLAR_STAGING_BASE_URL',
    journeys: [
      {
        key: 'discovery',
        label: 'School Requirements Page',
        category: 'discovery',
        requiresAuth: false,
        defaultMutationBudget: 'read-only',
        desktopPriority: 60,
        prodEntryUrl:
          'https://www.prepscholar.com/sat/s/colleges/Pitzer-College-admission-requirements',
        stagingEntryUrl: placeholderUrl(
          'prepscholar',
          'staging',
          'DISCOVERY_URL',
        ),
      },
      {
        key: 'profile',
        label: 'Profile',
        category: 'profile',
        requiresAuth: true,
        defaultMutationBudget: 'reversible-write',
        desktopPriority: 80,
        prodEntryUrl: placeholderUrl('prepscholar', 'prod', 'PROFILE_URL'),
        stagingEntryUrl: placeholderUrl(
          'prepscholar',
          'staging',
          'PROFILE_URL',
        ),
      },
      {
        key: 'chances',
        label: 'My College Chances',
        category: 'chances',
        requiresAuth: false,
        defaultMutationBudget: 'read-only',
        desktopPriority: 97,
        prodEntryUrl: 'https://mycollegechances.prepscholar.com/',
        stagingEntryUrl: placeholderUrl(
          'prepscholar',
          'staging',
          'CHANCES_URL',
        ),
      },
      {
        key: 'billing',
        label: 'Paid Upgrade',
        category: 'billing',
        requiresAuth: true,
        defaultMutationBudget: 'dangerous-write',
        desktopPriority: 78,
        prodEntryUrl: placeholderUrl('prepscholar', 'prod', 'BILLING_URL'),
        stagingEntryUrl: placeholderUrl(
          'prepscholar',
          'staging',
          'BILLING_URL',
        ),
      },
      {
        key: 'admin',
        label: 'Admin Surface',
        category: 'admin',
        requiresAuth: true,
        defaultMutationBudget: 'read-only',
        desktopPriority: 99,
        prodEntryUrl: placeholderUrl('prepscholar', 'prod', 'ADMIN_URL'),
        stagingEntryUrl: placeholderUrl('prepscholar', 'staging', 'ADMIN_URL'),
      },
    ],
    roles: [
      { role: 'guest', journeys: ['discovery', 'chances'] },
      { role: 'registered_consumer', journeys: ['profile'] },
      { role: 'profiled_consumer', journeys: ['profile', 'chances'] },
      { role: 'paid_consumer', journeys: ['profile', 'chances', 'billing'] },
      { role: 'admin_ops', journeys: ['admin', 'billing'] },
    ],
  },
];

export const DEFAULT_OWNED_SITE_ASSESSMENT_MANIFEST: OwnedSiteAssessmentManifest =
  {
    version: 1,
    generatedFrom:
      'apps/api/src/common/owned-site-assessment/default-manifest.ts',
    notes: [
      'Owned-site agent feasibility assessment scaffold covering CollegeVine, CampusReel, Niche, Parchment, College Raptor, Appily, and PrepScholar.',
      'Public production journeys are wired to known public URLs where available.',
      'Authenticated production, staging, and admin journey URLs intentionally use env placeholders so operators can fill exact private routes without editing code.',
      'Session storage files resolve under apps/api/.secrets/owned-site-assessment by default unless overridden in the runner.',
      'Desktop parity is modeled as a headed/manual probe plan derived from browser-pass findings rather than an embedded desktop-agent runtime.',
    ],
    journeyCatalog: SITE_SPECS.flatMap(buildJourneyDefinitions),
    targets: SITE_SPECS.flatMap(buildTargets),
    privilegeTransitions: SITE_SPECS.flatMap(buildTransitions),
  };

export function buildDefaultOwnedSiteAssessmentManifest(): OwnedSiteAssessmentManifest {
  return DEFAULT_OWNED_SITE_ASSESSMENT_MANIFEST;
}
