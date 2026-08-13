import type {
  OwnedSiteAgentFeasibility,
  OwnedSiteCoverageMatrixRow,
  OwnedSiteDataSurfaceKind,
  OwnedSiteDefenseBacklogItem,
  OwnedSiteDesktopProbeItem,
  OwnedSiteEnvironment,
  OwnedSiteExtractionPreference,
  OwnedSiteJourneyDefinition,
  OwnedSiteJourneyObservation,
  OwnedSiteMutationBudget,
  OwnedSitePaginationBehavior,
} from '@study-abroad/shared';
import {
  inferTargetStatusFromObservations,
  isHighPrivilegeRole,
} from './manifest';

function hasStructuredSurface(surfaces: OwnedSiteDataSurfaceKind[]): boolean {
  return surfaces.some((surface) =>
    ['bootstrap-json', 'rest', 'graphql', 'websocket', 'download'].includes(
      surface,
    ),
  );
}

export function inferExtractionPreference(input: {
  dataSurfaces: OwnedSiteDataSurfaceKind[];
  authSatisfied: boolean;
  challengePoints: string[];
}): OwnedSiteExtractionPreference {
  if (!input.authSatisfied) return 'unknown';
  if (input.challengePoints.length > 0) return 'unknown';
  if (hasStructuredSurface(input.dataSurfaces)) return 'browser';
  if (input.dataSurfaces.includes('dom')) return 'equal';
  return 'unknown';
}

export function classifyJourneyFeasibility(input: {
  mutationBudget: OwnedSiteMutationBudget;
  authRequired: boolean;
  authSatisfied: boolean;
  httpStatus?: number | null;
  dataSurfaces: OwnedSiteDataSurfaceKind[];
  visibleFields: string[];
  hiddenNetworkFields: string[];
  challengePoints: string[];
  riskNotes?: string[];
}): OwnedSiteAgentFeasibility {
  if (input.mutationBudget === 'dangerous-write') {
    return 'mutation-risk';
  }

  if (
    (input.authRequired && !input.authSatisfied) ||
    input.httpStatus === 401 ||
    input.httpStatus === 403
  ) {
    return 'blocked';
  }

  if (input.challengePoints.length > 0 || input.httpStatus === 429) {
    return 'fragile';
  }

  if (
    input.visibleFields.length > 0 ||
    input.hiddenNetworkFields.length > 0 ||
    input.dataSurfaces.length > 0
  ) {
    return 'reliable';
  }

  return 'fragile';
}

export function inferPaginationBehavior(input: {
  hasNextLink: boolean;
  hasLoadMore: boolean;
  infiniteScrollTriggered: boolean;
}): OwnedSitePaginationBehavior {
  if (input.infiniteScrollTriggered) return 'infinite-scroll';
  if (input.hasLoadMore) return 'load-more';
  if (input.hasNextLink) return 'next-link';
  return 'none';
}

export function buildCoverageMatrix(input: {
  targets: Array<{
    targetId: string;
    siteKey: string;
    environment: OwnedSiteEnvironment;
    role: string;
    siteRole?: string;
    accountLabel: string;
    journeys: string[];
    missingSession: boolean;
    unresolvedConfig: boolean;
  }>;
  observations: OwnedSiteJourneyObservation[];
}): OwnedSiteCoverageMatrixRow[] {
  return input.targets.map((target) => {
    const targetObservations = input.observations.filter(
      (observation) => observation.targetId === target.targetId,
    );
    const passesCompleted = Array.from(
      new Set(targetObservations.map((observation) => observation.pass)),
    );

    return {
      targetId: target.targetId,
      siteKey: target.siteKey as OwnedSiteCoverageMatrixRow['siteKey'],
      environment: target.environment,
      role: target.role as OwnedSiteCoverageMatrixRow['role'],
      siteRole: target.siteRole,
      accountLabel: target.accountLabel,
      journeysConfigured: target.journeys.length,
      journeysObserved: new Set(
        targetObservations.map((observation) => observation.journeyId),
      ).size,
      passesCompleted,
      status: inferTargetStatusFromObservations({
        observationsCount: targetObservations.length,
        expectedJourneys: target.journeys.length,
        missingSession: target.missingSession,
        unresolvedConfig: target.unresolvedConfig,
      }),
    };
  });
}

export function buildDefenseBacklog(
  observations: OwnedSiteJourneyObservation[],
): OwnedSiteDefenseBacklogItem[] {
  const backlog: OwnedSiteDefenseBacklogItem[] = [];

  const guestStructured = observations.filter(
    (observation) =>
      observation.role === 'guest' &&
      hasStructuredSurface(observation.dataSurfaces) &&
      observation.hiddenNetworkFields.length > 0,
  );

  for (const observation of guestStructured) {
    backlog.push({
      siteKey: observation.siteKey,
      severity: 'medium',
      title: 'Reduce guest-visible structured payloads',
      rationale:
        'Guest journeys expose structured network or bootstrap fields beyond what the DOM alone needs.',
      evidenceJourneyIds: [observation.journeyId],
    });
  }

  const tokenStorage = observations.filter(
    (observation) => observation.authSession.tokenStorageRisks.length > 0,
  );

  for (const observation of tokenStorage) {
    backlog.push({
      siteKey: observation.siteKey,
      severity: isHighPrivilegeRole(observation.role, observation.siteRole)
        ? 'high'
        : 'medium',
      title: 'Move bearer/session material out of script-readable storage',
      rationale: observation.authSession.tokenStorageRisks.join(' '),
      evidenceJourneyIds: [observation.journeyId],
    });
  }

  const downloadSurfaces = observations.filter(
    (observation) => observation.exportDownloadSurfaces.length > 0,
  );

  for (const observation of downloadSurfaces) {
    backlog.push({
      siteKey: observation.siteKey,
      severity: isHighPrivilegeRole(observation.role, observation.siteRole)
        ? 'high'
        : 'low',
      title: 'Audit export/download endpoints and add extra monitoring',
      rationale:
        'The assessed journey exposes explicit export or download surfaces that are attractive to automated extraction.',
      evidenceJourneyIds: [observation.journeyId],
    });
  }

  const deduped = new Map<string, OwnedSiteDefenseBacklogItem>();
  for (const item of backlog) {
    const key = `${item.siteKey}:${item.title}`;
    const existing = deduped.get(key);
    if (existing) {
      existing.evidenceJourneyIds = Array.from(
        new Set([...existing.evidenceJourneyIds, ...item.evidenceJourneyIds]),
      );
      if (existing.severity === 'medium' && item.severity === 'high') {
        existing.severity = 'high';
      }
    } else {
      deduped.set(key, item);
    }
  }

  return Array.from(deduped.values()).sort((a, b) =>
    `${a.siteKey}:${a.title}`.localeCompare(`${b.siteKey}:${b.title}`),
  );
}

export function buildDesktopProbePlan(input: {
  journeys: OwnedSiteJourneyDefinition[];
  observations: OwnedSiteJourneyObservation[];
  targets: Array<{
    targetId: string;
    siteKey: string;
    environment: OwnedSiteEnvironment;
    role: string;
    siteRole?: string;
    journeys: string[];
  }>;
}): OwnedSiteDesktopProbeItem[] {
  const journeyMap = new Map(
    input.journeys.map((journey) => [journey.journeyId, journey]),
  );

  const grouped = new Map<string, OwnedSiteDesktopProbeItem[]>();

  for (const target of input.targets) {
    const candidateJourneys = target.journeys
      .map((journeyId) => journeyMap.get(journeyId))
      .filter((journey): journey is OwnedSiteJourneyDefinition =>
        Boolean(journey),
      )
      .sort((a, b) => b.desktopPriority - a.desktopPriority)
      .slice(0, 3);

    for (const journey of candidateJourneys) {
      const browserObservation = input.observations.find(
        (observation) =>
          observation.targetId === target.targetId &&
          observation.journeyId === journey.journeyId &&
          observation.pass === 'browser',
      );

      const item: OwnedSiteDesktopProbeItem = {
        siteKey: target.siteKey as OwnedSiteDesktopProbeItem['siteKey'],
        environment: target.environment,
        targetId: target.targetId,
        role: target.role as OwnedSiteDesktopProbeItem['role'],
        siteRole: target.siteRole,
        journeyId: journey.journeyId,
        journeyLabel: journey.label,
        entryUrl: journey.entryUrl,
        whyHighValue:
          journey.category === 'admin' || journey.category === 'institution'
            ? 'High-privilege surface with likely richer data than public routes.'
            : journey.category === 'chances'
              ? 'Core value surface where the true data-bearing endpoints usually sit.'
              : 'High-frequency user workflow worth comparing against browser automation.',
        browserFindingExcerpt: browserObservation
          ? `${browserObservation.agentFeasibility}; surfaces=${
              browserObservation.dataSurfaces.join(',') || 'none'
            }`
          : undefined,
        manualSteps: [
          `Open ${journey.entryUrl} in a headed session for ${target.targetId}.`,
          'Perform the minimum safe interaction needed to load the real data-bearing UI state.',
          'Note any fields or panels that appear only after interactive use.',
          'Compare the manual result with the browser-pass endpoint inventory.',
        ],
      };

      const key = `${target.siteKey}:${target.environment}`;
      const items = grouped.get(key) ?? [];
      items.push(item);
      grouped.set(key, items);
    }
  }

  return Array.from(grouped.values())
    .flatMap((items) => items.slice(0, 3))
    .sort((a, b) =>
      `${a.siteKey}:${a.environment}:${a.journeyId}`.localeCompare(
        `${b.siteKey}:${b.environment}:${b.journeyId}`,
      ),
    );
}
