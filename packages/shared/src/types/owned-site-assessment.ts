export type OwnedSiteKey =
  | 'collegevine'
  | 'campusreel'
  | 'niche'
  | 'parchment'
  | 'college-raptor'
  | 'appily'
  | 'prepscholar';

export type OwnedSiteEnvironment = 'prod' | 'staging';

export type OwnedSiteRole =
  | 'guest'
  | 'registered_consumer'
  | 'profiled_consumer'
  | 'paid_consumer'
  | 'collaborator'
  | 'institution_staff'
  | 'admin_ops';

export type OwnedSiteMutationBudget = 'read-only' | 'reversible-write' | 'dangerous-write';

export type OwnedSiteJourneyCategory =
  | 'discovery'
  | 'profile'
  | 'chances'
  | 'saved_list'
  | 'messaging'
  | 'billing'
  | 'institution'
  | 'admin';

export type OwnedSiteAssessmentPass = 'public' | 'browser' | 'desktop';

export type OwnedSiteDataSurfaceKind =
  | 'dom'
  | 'bootstrap-json'
  | 'rest'
  | 'graphql'
  | 'websocket'
  | 'download'
  | 'cookie'
  | 'local-storage'
  | 'session-storage';

export type OwnedSiteAgentFeasibility = 'reliable' | 'fragile' | 'blocked' | 'mutation-risk';

export type OwnedSitePaginationBehavior =
  'none' | 'next-link' | 'load-more' | 'infinite-scroll' | 'unknown';

export type OwnedSiteExtractionPreference = 'browser' | 'desktop' | 'equal' | 'unknown';

export interface OwnedSiteJourneyDefinition {
  journeyId: string;
  siteKey: OwnedSiteKey;
  label: string;
  category: OwnedSiteJourneyCategory;
  entryUrl: string;
  requiresAuth: boolean;
  defaultMutationBudget: OwnedSiteMutationBudget;
  desktopPriority: number;
  notes?: string[];
}

export interface OwnedSiteAssessmentTarget {
  targetId: string;
  siteKey: OwnedSiteKey;
  environment: OwnedSiteEnvironment;
  role: OwnedSiteRole;
  siteRole?: string;
  loginUrl: string;
  homeUrl: string;
  journeys: string[];
  mutationBudget: OwnedSiteMutationBudget;
  accountLabel: string;
  accountOwner: string;
}

export interface OwnedSitePrivilegeTransition {
  transitionId: string;
  siteKey: OwnedSiteKey;
  environment: OwnedSiteEnvironment | 'any';
  fromRole: OwnedSiteRole;
  fromSiteRole?: string;
  toRole: OwnedSiteRole;
  toSiteRole?: string;
  transitionLabel: string;
  transitionUrl?: string;
  notes?: string[];
}

export interface OwnedSiteAssessmentManifest {
  version: number;
  generatedFrom?: string;
  notes?: string[];
  journeyCatalog: OwnedSiteJourneyDefinition[];
  targets: OwnedSiteAssessmentTarget[];
  privilegeTransitions: OwnedSitePrivilegeTransition[];
}

export interface OwnedSiteEndpointObservation {
  url: string;
  method?: string;
  status?: number | null;
  contentType?: string | null;
  surface: OwnedSiteDataSurfaceKind | 'document';
  sampleKeys?: string[];
}

export interface OwnedSiteAuthSessionObservation {
  cookieNames: string[];
  localStorageKeys: string[];
  sessionStorageKeys: string[];
  tokenStorageRisks: string[];
}

export interface OwnedSiteJourneyObservation {
  targetId: string;
  siteKey: OwnedSiteKey;
  environment: OwnedSiteEnvironment;
  role: OwnedSiteRole;
  siteRole?: string;
  accountLabel: string;
  pass: OwnedSiteAssessmentPass;
  journeyId: string;
  journeyLabel: string;
  journeyCategory: OwnedSiteJourneyCategory;
  entryUrl: string;
  finalUrl?: string | null;
  authRequired: boolean;
  authSatisfied: boolean;
  httpStatus?: number | null;
  pageTitle?: string | null;
  dataSurfaces: OwnedSiteDataSurfaceKind[];
  visibleFields: string[];
  hiddenNetworkFields: string[];
  endpointInventory: OwnedSiteEndpointObservation[];
  authSession: OwnedSiteAuthSessionObservation;
  paginationBehavior: OwnedSitePaginationBehavior;
  exportDownloadSurfaces: string[];
  uiRoleGuards: string[];
  apiRoleGuards: string[];
  challengePoints: string[];
  agentFeasibility: OwnedSiteAgentFeasibility;
  extractionPreference: OwnedSiteExtractionPreference;
  riskNotes: string[];
}

export interface OwnedSiteCoverageMatrixRow {
  targetId: string;
  siteKey: OwnedSiteKey;
  environment: OwnedSiteEnvironment;
  role: OwnedSiteRole;
  siteRole?: string;
  accountLabel: string;
  journeysConfigured: number;
  journeysObserved: number;
  passesCompleted: OwnedSiteAssessmentPass[];
  status: 'complete' | 'partial' | 'missing-session' | 'pending-config';
}

export interface OwnedSiteDefenseBacklogItem {
  siteKey: OwnedSiteKey;
  severity: 'high' | 'medium' | 'low';
  title: string;
  rationale: string;
  evidenceJourneyIds: string[];
}

export interface OwnedSiteDesktopProbeItem {
  siteKey: OwnedSiteKey;
  environment: OwnedSiteEnvironment;
  targetId: string;
  role: OwnedSiteRole;
  siteRole?: string;
  journeyId: string;
  journeyLabel: string;
  entryUrl: string;
  whyHighValue: string;
  browserFindingExcerpt?: string;
  manualSteps: string[];
}

export interface OwnedSiteAssessmentBundle {
  manifestVersion: number;
  generatedAt: string;
  passesRun: OwnedSiteAssessmentPass[];
  manifestPath?: string;
  notes?: string[];
  coverageMatrix: OwnedSiteCoverageMatrixRow[];
  privilegeTransitions: OwnedSitePrivilegeTransition[];
  defenseBacklog: OwnedSiteDefenseBacklogItem[];
  desktopProbePlan: OwnedSiteDesktopProbeItem[];
  observations: OwnedSiteJourneyObservation[];
}
