import { Prisma } from '@prisma/client';

/**
 * User fields for team member display — includes email and profile.
 */
export const TEAM_USER_SELECT = {
  id: true,
  email: true,
  profile: { select: { nickname: true, avatarUrl: true } },
} as const satisfies Prisma.UserSelect;

/**
 * Competition edition + its competition + active tracks, for the public
 * competition-schedule read (the events-timeline foundation). Dates are
 * populated by the /competition-data-update skill; `sourceMeta` carries
 * provenance (null = synthetic seed date, not web-verified).
 */
export const COMPETITION_EDITION_SELECT = {
  id: true,
  seasonLabel: true,
  registrationOpenAt: true,
  registrationCloseAt: true,
  eventStartAt: true,
  eventEndAt: true,
  sourceMeta: true,
  competition: {
    select: {
      abbreviation: true,
      name: true,
      nameZh: true,
      category: true,
      tier: true,
      website: true,
    },
  },
  tracks: {
    where: { isActive: true },
    select: { name: true, minTeamSize: true, maxTeamSize: true },
  },
} as const satisfies Prisma.CompetitionEditionSelect;

export type CompetitionEditionResult = Prisma.CompetitionEditionGetPayload<{
  select: typeof COMPETITION_EDITION_SELECT;
}>;

export function mapCompetitionEdition(e: CompetitionEditionResult) {
  const meta = (e.sourceMeta ?? null) as {
    sourceUrl?: string;
    confidence?: string;
  } | null;
  return {
    id: e.id,
    seasonLabel: e.seasonLabel,
    competition: {
      abbreviation: e.competition.abbreviation,
      name: e.competition.name,
      nameZh: e.competition.nameZh,
      category: e.competition.category,
      tier: e.competition.tier,
      website: e.competition.website,
    },
    registrationOpenAt: e.registrationOpenAt,
    registrationCloseAt: e.registrationCloseAt,
    eventStartAt: e.eventStartAt,
    eventEndAt: e.eventEndAt,
    // Provenance: are these dates web-verified (real) or synthetic seed?
    verified: meta?.sourceUrl != null,
    sourceUrl: meta?.sourceUrl ?? null,
    confidence: meta?.confidence ?? null,
    tracks: e.tracks.map((t) => ({
      name: t.name,
      minTeamSize: t.minTeamSize,
      maxTeamSize: t.maxTeamSize,
    })),
  };
}
