export type RecruitmentHighlightTone =
  | 'neutral'
  | 'success'
  | 'warning'
  | 'danger';

export type RecruitmentHighlightSource =
  | 'PROFILE'
  | 'TEST_SCORE'
  | 'AWARD'
  | 'ACTIVITY'
  | 'RESUME'
  | 'ASSESSMENT';

export interface RecruitmentHighlightChip {
  label: string;
  tone: RecruitmentHighlightTone;
  source: RecruitmentHighlightSource;
  sourceId?: string;
}

export interface RecruitmentMemberHighlights {
  academics: RecruitmentHighlightChip[];
  experiences: RecruitmentHighlightChip[];
  personality: RecruitmentHighlightChip[];
}

export interface RecruitmentHighlightBuildOptions {
  requireConsent?: boolean;
}

type RecruitmentMemberProfileForHighlights =
  | {
      showAcademics?: boolean | null;
      showExperiences?: boolean | null;
      showPersonality?: boolean | null;
      consentConfirmedAt?: Date | string | null;
      selectedResume?: { sections?: unknown[] | null } | null;
    }
  | null
  | undefined;

const ACADEMIC_LIMIT = 8;
const EXPERIENCE_LIMIT = 3;
const PERSONALITY_LIMIT = 4;

const TEST_TYPE_LABELS: Record<string, string> = {
  A_LEVEL: 'A-Level',
  DUOLINGO: 'DET',
};

const SUBJECT_TEST_TYPES = new Set(['AP', 'IB', 'A_LEVEL', 'IGCSE']);
const TEST_TYPE_PRIORITY = [
  'SAT',
  'ACT',
  'TOEFL',
  'IELTS',
  'DUOLINGO',
  'AP',
  'IB',
  'A_LEVEL',
  'IGCSE',
];

const AWARD_LEVEL_RANK: Record<string, number> = {
  INTERNATIONAL: 5,
  NATIONAL: 4,
  STATE: 3,
  REGIONAL: 2,
  SCHOOL: 1,
};

function normalizeTestType(type: unknown): string {
  return String(type ?? '')
    .trim()
    .toUpperCase()
    .replace(/[-\s]+/g, '_');
}

function dedupeHighlights(
  chips: RecruitmentHighlightChip[],
  limit: number,
): RecruitmentHighlightChip[] {
  const seen = new Set<string>();
  const result: RecruitmentHighlightChip[] = [];
  for (const chip of chips) {
    const label = chip.label.trim();
    if (!label || seen.has(label.toLowerCase())) continue;
    seen.add(label.toLowerCase());
    result.push({ ...chip, label });
    if (result.length >= limit) break;
  }
  return result;
}

function parseJsonObject(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  return typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function displayTestType(type: unknown): string {
  const normalized = normalizeTestType(type);
  return TEST_TYPE_LABELS[normalized] ?? normalized;
}

export function getApHighlightTone(score: unknown): RecruitmentHighlightTone {
  const numeric = Number(score);
  if (numeric >= 4) return 'success';
  if (numeric === 3) return 'warning';
  if (numeric > 0 && numeric <= 2) return 'danger';
  return 'neutral';
}

function buildSubjectScoreLabel(
  type: string,
  subject: string | null,
  score: unknown,
): string {
  const parts = [
    displayTestType(type),
    subject,
    score == null ? '' : String(score),
  ]
    .filter(Boolean)
    .map(String);
  return parts.join(' ');
}

function parseResumeItems(content: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(content)) return content as Array<Record<string, unknown>>;
  const object = parseJsonObject(content);
  if (Array.isArray(object.items))
    return object.items as Array<Record<string, unknown>>;
  if (Array.isArray(object.entries))
    return object.entries as Array<Record<string, unknown>>;
  return [];
}

function getPriority(type: unknown) {
  const index = TEST_TYPE_PRIORITY.indexOf(normalizeTestType(type));
  return index >= 0 ? index : TEST_TYPE_PRIORITY.length;
}

function extractAcademicHighlights(
  memberUser: unknown,
  memberProfile: RecruitmentMemberProfileForHighlights,
): RecruitmentHighlightChip[] {
  const user = memberUser as {
    profile?: { testScores?: unknown[] | null } | null;
  };
  const profileScores = Array.isArray(user.profile?.testScores)
    ? user.profile.testScores
    : [];

  const chips: RecruitmentHighlightChip[] = [];
  const sortedScores = [...profileScores].sort(
    (a, b) =>
      getPriority((a as { type?: unknown }).type) -
      getPriority((b as { type?: unknown }).type),
  );

  for (const rawScore of sortedScores) {
    const score = rawScore as {
      id?: string;
      type?: string;
      score?: number | string | null;
      subject?: string | null;
      subScores?: unknown;
    };
    const type = normalizeTestType(score.type);
    if (!type) continue;
    const subScores = parseJsonObject(score.subScores);
    const explicitSubject =
      typeof score.subject === 'string' && score.subject.trim()
        ? score.subject.trim()
        : typeof subScores.subject === 'string' && subScores.subject.trim()
          ? subScores.subject.trim()
          : null;

    if (SUBJECT_TEST_TYPES.has(type)) {
      const subjectEntries = Object.entries(subScores).filter(
        ([subject]) => subject !== 'subject',
      );
      if (subjectEntries.length > 0) {
        for (const [subject, value] of subjectEntries) {
          chips.push({
            label: buildSubjectScoreLabel(type, subject, value),
            tone: type === 'AP' ? getApHighlightTone(value) : 'neutral',
            source: 'TEST_SCORE',
            sourceId: score.id,
          });
        }
      } else {
        chips.push({
          label: buildSubjectScoreLabel(type, explicitSubject, score.score),
          tone: type === 'AP' ? getApHighlightTone(score.score) : 'neutral',
          source: 'TEST_SCORE',
          sourceId: score.id,
        });
      }
      continue;
    }

    chips.push({
      label: `${displayTestType(type)} ${score.score ?? ''}`,
      tone: 'neutral',
      source: 'TEST_SCORE',
      sourceId: score.id,
    });
  }

  const resumeSections = Array.isArray(memberProfile?.selectedResume?.sections)
    ? memberProfile.selectedResume.sections
    : [];
  for (const section of resumeSections) {
    const typedSection = section as { type?: string; content?: unknown };
    if (typedSection.type !== 'TEST_SCORES') continue;
    const items = parseResumeItems(typedSection.content);
    for (const item of items) {
      const type = normalizeTestType(item.type);
      const score = item.score ?? item.composite ?? '';
      if (!type || score === '') continue;
      const subject =
        typeof item.subject === 'string' && item.subject.trim()
          ? item.subject.trim()
          : typeof item.name === 'string' && item.name.trim()
            ? item.name.trim()
            : typeof item.title === 'string' && item.title.trim()
              ? item.title.trim()
              : null;
      chips.push({
        label: SUBJECT_TEST_TYPES.has(type)
          ? buildSubjectScoreLabel(type, subject, score)
          : `${displayTestType(type)} ${score}`,
        tone: type === 'AP' ? getApHighlightTone(score) : 'neutral',
        source: 'RESUME',
        sourceId: typeof item.id === 'string' ? item.id : undefined,
      });
    }
  }

  return dedupeHighlights(chips, ACADEMIC_LIMIT);
}

function extractExperienceHighlights(
  memberUser: unknown,
  memberProfile: RecruitmentMemberProfileForHighlights,
): RecruitmentHighlightChip[] {
  const user = memberUser as {
    profile?: {
      awards?: unknown[] | null;
      activities?: unknown[] | null;
    } | null;
  };
  const awards = Array.isArray(user.profile?.awards) ? user.profile.awards : [];
  const activities = Array.isArray(user.profile?.activities)
    ? user.profile.activities
    : [];
  const chips: RecruitmentHighlightChip[] = [];

  [...awards]
    .sort((a, b) => {
      const left = String((a as { level?: unknown }).level ?? '').toUpperCase();
      const right = String(
        (b as { level?: unknown }).level ?? '',
      ).toUpperCase();
      return (AWARD_LEVEL_RANK[right] ?? 0) - (AWARD_LEVEL_RANK[left] ?? 0);
    })
    .forEach((rawAward) => {
      const award = rawAward as {
        id?: string;
        name?: string | null;
        title?: string | null;
        year?: number | null;
        competition?: {
          abbreviation?: string | null;
          name?: string | null;
        } | null;
      };
      const name =
        award.name ||
        award.title ||
        award.competition?.abbreviation ||
        award.competition?.name;
      if (!name) return;
      chips.push({
        label: award.year ? `${award.year} ${name}` : name,
        tone: 'neutral',
        source: 'AWARD',
        sourceId: award.id,
      });
    });

  for (const rawActivity of activities) {
    const activity = rawActivity as {
      id?: string;
      name?: string | null;
      title?: string | null;
      role?: string | null;
      activityTemplate?: { name?: string | null } | null;
    };
    const name =
      activity.name || activity.title || activity.activityTemplate?.name;
    if (!name) continue;
    chips.push({
      label: activity.role ? `${activity.role} · ${name}` : name,
      tone: 'neutral',
      source: 'ACTIVITY',
      sourceId: activity.id,
    });
  }

  const resumeSections = Array.isArray(memberProfile?.selectedResume?.sections)
    ? memberProfile.selectedResume.sections
    : [];
  for (const section of resumeSections) {
    const typedSection = section as {
      id?: string;
      type?: string;
      content?: unknown;
    };
    if (
      ![
        'AWARDS',
        'ACTIVITIES',
        'PROJECTS',
        'RESEARCH',
        'WORK_EXPERIENCE',
      ].includes(typedSection.type ?? '')
    ) {
      continue;
    }
    const items = parseResumeItems(typedSection.content);
    for (const item of items) {
      const label =
        item.name ??
        item.title ??
        item.company ??
        item.institution ??
        item.organization ??
        null;
      if (!label) continue;
      chips.push({
        label: String(label),
        tone: 'neutral',
        source: 'RESUME',
        sourceId: typeof item.id === 'string' ? item.id : typedSection.id,
      });
    }
  }

  return dedupeHighlights(chips, EXPERIENCE_LIMIT);
}

function normalizeHollandCodes(value: unknown): string | null {
  if (Array.isArray(value)) return value.map(String).join('').toUpperCase();
  if (value)
    return String(value)
      .replace(/[\s,]+/g, '')
      .toUpperCase();
  return null;
}

function extractPersonalityHighlights(
  memberUser: unknown,
): RecruitmentHighlightChip[] {
  const user = memberUser as { assessmentResults?: unknown[] | null };
  const results = Array.isArray(user.assessmentResults)
    ? user.assessmentResults
    : [];
  const chips: RecruitmentHighlightChip[] = [];

  for (const rawResult of results) {
    const item = rawResult as {
      id?: string;
      assessment?: { type?: string } | null;
      result?: unknown;
    };
    const type = String(item.assessment?.type ?? '').toUpperCase();
    const result = parseJsonObject(item.result);

    if (type === 'MBTI') {
      const mbtiType = result.type ?? result.mbtiType;
      if (mbtiType) {
        chips.push({
          label: String(mbtiType).toUpperCase(),
          tone: 'neutral',
          source: 'ASSESSMENT',
          sourceId: item.id,
        });
      }
      continue;
    }

    if (type === 'HOLLAND') {
      const codes = normalizeHollandCodes(
        result.codes ?? result.hollandCodes ?? result.code,
      );
      if (codes) {
        chips.push({
          label: `Holland ${codes}`,
          tone: 'neutral',
          source: 'ASSESSMENT',
          sourceId: item.id,
        });
      }
    }
  }

  return dedupeHighlights(chips, PERSONALITY_LIMIT);
}

function canShowCategory(
  profile: RecruitmentMemberProfileForHighlights,
  category: 'academics' | 'experiences' | 'personality',
  options: RecruitmentHighlightBuildOptions,
) {
  if (!profile) return false;
  const enabled =
    category === 'academics'
      ? profile.showAcademics
      : category === 'experiences'
        ? profile.showExperiences
        : profile.showPersonality;
  if (!enabled) return false;
  return !options.requireConsent || Boolean(profile.consentConfirmedAt);
}

export function buildMemberHighlights(
  memberUser: unknown,
  memberProfile: RecruitmentMemberProfileForHighlights,
  options: RecruitmentHighlightBuildOptions = {},
): RecruitmentMemberHighlights {
  return {
    academics: canShowCategory(memberProfile, 'academics', options)
      ? extractAcademicHighlights(memberUser, memberProfile)
      : [],
    experiences: canShowCategory(memberProfile, 'experiences', options)
      ? extractExperienceHighlights(memberUser, memberProfile)
      : [],
    personality: canShowCategory(memberProfile, 'personality', options)
      ? extractPersonalityHighlights(memberUser)
      : [],
  };
}

export function getVisibleDisplaySettings(
  memberProfile: RecruitmentMemberProfileForHighlights,
  options: RecruitmentHighlightBuildOptions = {},
) {
  return {
    showAcademics: canShowCategory(memberProfile, 'academics', options),
    showExperiences: canShowCategory(memberProfile, 'experiences', options),
    showPersonality: canShowCategory(memberProfile, 'personality', options),
  };
}
