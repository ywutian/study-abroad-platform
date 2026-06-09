import type { RouteSurfaceDefinition } from './full-surface-registry';

export const RELEASE_RUNTIME_ENVIRONMENTS = ['local', 'production'] as const;
export type ReleaseRuntimeEnvironment = (typeof RELEASE_RUNTIME_ENVIRONMENTS)[number];

export const RELEASE_RUNTIME_STATUSES = [
  'PASS',
  'BROKEN',
  'NAVIGATION_FAILED',
  'STUCK_LOADING',
  'SLOW_FRONTEND',
  'SLOW_API',
  'COLD_START_ONLY',
  'BLOCKED_SAMPLE',
] as const;
export type ReleaseRuntimeStatus = (typeof RELEASE_RUNTIME_STATUSES)[number];

export const RELEASE_RUNTIME_HARD_FAIL_STATUSES = [
  'BROKEN',
  'NAVIGATION_FAILED',
  'STUCK_LOADING',
  'BLOCKED_SAMPLE',
] as const satisfies readonly ReleaseRuntimeStatus[];

export const RELEASE_RUNTIME_SLOW_STATUSES = [
  'SLOW_FRONTEND',
  'SLOW_API',
] as const satisfies readonly ReleaseRuntimeStatus[];

export type ReleaseRuntimeLayer = 'public' | 'auth' | 'app' | 'admin';

export interface ReleaseRuntimeBudget {
  ttfbMs: number;
  domContentLoadedMs: number;
  firstContentfulPaintMs: number;
  loadMs: number;
  navigationMs: number;
  apiRequestMs: number;
}

export const RELEASE_RUNTIME_BUDGETS = {
  local: {
    public: {
      ttfbMs: 1_200,
      domContentLoadedMs: 3_500,
      firstContentfulPaintMs: 2_500,
      loadMs: 5_000,
      navigationMs: 5_000,
      apiRequestMs: 2_500,
    },
    auth: {
      ttfbMs: 1_500,
      domContentLoadedMs: 3_500,
      firstContentfulPaintMs: 2_800,
      loadMs: 5_000,
      navigationMs: 5_000,
      apiRequestMs: 2_500,
    },
    app: {
      ttfbMs: 2_000,
      domContentLoadedMs: 5_000,
      firstContentfulPaintMs: 3_500,
      loadMs: 6_000,
      navigationMs: 5_000,
      apiRequestMs: 3_000,
    },
    admin: {
      ttfbMs: 2_000,
      domContentLoadedMs: 5_000,
      firstContentfulPaintMs: 3_800,
      loadMs: 6_500,
      navigationMs: 5_000,
      apiRequestMs: 3_500,
    },
  },
  production: {
    public: {
      ttfbMs: 2_500,
      domContentLoadedMs: 5_000,
      firstContentfulPaintMs: 3_500,
      loadMs: 7_000,
      navigationMs: 8_000,
      apiRequestMs: 4_000,
    },
    auth: {
      ttfbMs: 3_000,
      domContentLoadedMs: 5_000,
      firstContentfulPaintMs: 3_800,
      loadMs: 7_000,
      navigationMs: 8_000,
      apiRequestMs: 4_000,
    },
    app: {
      ttfbMs: 3_500,
      domContentLoadedMs: 8_000,
      firstContentfulPaintMs: 5_000,
      loadMs: 10_000,
      navigationMs: 8_000,
      apiRequestMs: 5_000,
    },
    admin: {
      ttfbMs: 4_000,
      domContentLoadedMs: 8_000,
      firstContentfulPaintMs: 5_500,
      loadMs: 10_000,
      navigationMs: 8_000,
      apiRequestMs: 5_500,
    },
  },
} as const satisfies Record<
  ReleaseRuntimeEnvironment,
  Record<ReleaseRuntimeLayer, ReleaseRuntimeBudget>
>;

export interface ReleaseRuntimeWaiver {
  surfaceId: string;
  status: (typeof RELEASE_RUNTIME_SLOW_STATUSES)[number] | 'COLD_START_ONLY';
  reason: string;
  owner: string;
  expiresOn: string;
  issueFingerprint?: string;
}

export interface ReleaseRuntimeWaiverFile {
  waivers: ReleaseRuntimeWaiver[];
}

export function normalizeReleaseRuntimeEnvironment(value: string): ReleaseRuntimeEnvironment {
  return value === 'production' ? 'production' : 'local';
}

export function releaseRuntimeLayer(surface: RouteSurfaceDefinition): ReleaseRuntimeLayer {
  if (surface.routeMetadata.authBoundary === 'admin' || surface.persona === 'admin') {
    return 'admin';
  }
  if (surface.routeMetadata.authBoundary === 'auth') {
    return 'auth';
  }
  if (surface.routeMetadata.authBoundary === 'public' && surface.persona === 'guest') {
    return 'public';
  }
  return 'app';
}

export function releaseRuntimeBudget(
  environment: ReleaseRuntimeEnvironment,
  surface: RouteSurfaceDefinition
): ReleaseRuntimeBudget {
  return RELEASE_RUNTIME_BUDGETS[environment][releaseRuntimeLayer(surface)];
}

export function isReleaseRuntimeStatus(value: string): value is ReleaseRuntimeStatus {
  return RELEASE_RUNTIME_STATUSES.includes(value as ReleaseRuntimeStatus);
}
