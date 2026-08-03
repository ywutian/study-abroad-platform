import { Prisma } from '@prisma/client';

/**
 * User fields for team member display.
 *
 * No email. This select feeds two `@Public()` routes — `GET /teams` (creator)
 * and `GET /teams/:id` (creator *and* every member) — and nothing downstream
 * strips it: the repo has no `ClassSerializerInterceptor` and no `@Exclude`,
 * and `TransformInterceptor` only wraps the payload in the envelope. So an
 * unauthenticated caller could read every member's email address by asking for
 * the team.
 *
 * That is strictly worse than the four de-anonymisation leaks this branch
 * fixed: `userId` still had to be matched against the forum feed to yield a
 * name, an email is the identity outright. `hall-list.service.ts` had already
 * reached the opposite conclusion for the same shape ("the list creator's email
 * is PII … never the email") — team simply never got the same treatment.
 *
 * A surface that genuinely needs an email should select it explicitly, next to
 * the check that says why it may. One does: the matched-conversation preview in
 * `team-recruitment.service` spreads this and adds `email`, on an authenticated
 * route that returns only conversations the caller participates in. It is there
 * because ChatContextPanel's display-name chain still falls back to the email's
 * local part — the same fallback that renders a deleted account as
 * `deleted_<userId>`. When that fallback goes, the extra field goes with it.
 */
export const TEAM_USER_SELECT = {
  id: true,
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
