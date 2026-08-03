import { Injectable, Logger } from '@nestjs/common';
import type { EssayDebateSession, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { DebateContextPayload } from './essay-debate.prompts';
import type { DebateTurnDto } from './dto/debate-turn-response.dto';

/**
 * Phase 2 V1 PR2 — assembles the 6 context classes documented in
 * `CONTEXT_AUDIT.md` for an essay-debate turn. The loader fans out in
 * parallel and tolerates missing pieces (user-owned essay has no
 * admission result, freshly-uploaded gallery essay has no precomputed
 * paragraph commentary, etc.) — every class falls back to `null` rather
 * than throwing so the prompt builder can render whatever it has.
 *
 * We deliberately avoid importing SchoolService / ProfileService here:
 *
 *  - SchoolService.findById() pulls 5 metrics + rankings + media joins
 *    that we don't need and would inflate the input.
 *  - ProfileService transitively imports PredictionModule + AiModule,
 *    creating a heavy dependency tree we don't want EssayDebateModule
 *    to take on. Direct Prisma queries with narrow selects are simpler.
 *
 * The 6 fetch points are deliberately labelled below — they line up 1:1
 * with the table rows in `CONTEXT_AUDIT.md`.
 */

/** Shape of one entry in `AdmissionCase.aiAnalysisCache[locale]`. */
interface CachedAnalysisEntry {
  promptVersion?: string;
  generatedAt?: string;
  payload?: {
    paragraphs?: Array<{
      paragraphIndex?: number;
      score?: number;
      status?: string;
      comment?: string;
      highlights?: string[];
      suggestions?: string[];
    }>;
  };
}

/** Loader output (the prompt builder consumes this directly). */
export type DebateContext = DebateContextPayload;

@Injectable()
export class DebateContextLoaderService {
  private readonly logger = new Logger(DebateContextLoaderService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Build a `DebateContext` from the session. Locale defaults to `zh`
   * because that's our primary user base; PR2 only stores prior
   * commentary in the cached locale anyway.
   */
  async loadContext(
    session: EssayDebateSession,
    locale: 'zh' | 'en' = 'zh',
  ): Promise<DebateContext> {
    const paragraphIndex = session.paragraphIndex ?? null;
    const existingTurns: DebateTurnDto[] = Array.isArray(session.turns)
      ? (session.turns as unknown as DebateTurnDto[])
      : [];

    // ─── Class 3 + 5: essay text + result ────────────────────────────────
    // Class 3 lives in two places: `AdmissionCase.essayContent` (gallery)
    // or `Essay.content` (user draft). The session row already disambiguates
    // via the admissionCaseId / essayId columns set by the service.
    //
    // We fetch the source row + its school in a single round-trip — this is
    // the loader's biggest query and also pulls Class 1 (school) + Class 4
    // (prompt) + Class 6 (aiAnalysisCache when it exists on a gallery row).
    let essayFullText = '';
    let prompt: string | null = null;
    let resultClass: DebateContext['result'] = null;
    let priorCommentary: DebateContext['priorCommentary'] = null;
    let schoolPayload: DebateContext['school'] = null;
    let hasGalleryCase = false;

    if (session.admissionCaseId) {
      // Gallery path. CONTEXT_AUDIT.md line 20.
      const ac = await this.prisma.admissionCase.findUnique({
        where: { id: session.admissionCaseId },
        select: {
          year: true,
          round: true,
          result: true,
          essayPrompt: true,
          essayContent: true,
          aiAnalysisCache: true,
          school: {
            select: {
              name: true,
              nameZh: true,
              usNewsRank: true,
              acceptanceRate: true,
            },
          },
        },
      });
      if (ac) {
        hasGalleryCase = true;
        essayFullText = ac.essayContent ?? '';
        prompt = ac.essayPrompt ?? null;
        resultClass = {
          result: ac.result,
          year: ac.year,
          round: ac.round ?? null,
        };
        schoolPayload = ac.school
          ? {
              name: ac.school.name,
              nameZh: ac.school.nameZh ?? null,
              usNewsRank: ac.school.usNewsRank ?? null,
              acceptanceRate: ac.school.acceptanceRate
                ? Number(ac.school.acceptanceRate)
                : null,
            }
          : null;
        // Class 6 — only present if precompute has run for this case.
        if (ac.aiAnalysisCache) {
          priorCommentary = this.pickParagraphFromCache(
            ac.aiAnalysisCache,
            locale,
            paragraphIndex,
          );
        }
      }
    } else if (session.essayId) {
      // User-owned essay path. CONTEXT_AUDIT.md line 20 + 21.
      const essay = await this.prisma.essay.findUnique({
        where: { id: session.essayId },
        select: {
          content: true,
          prompt: true,
          essayPromptId: true,
          schoolId: true,
        },
      });
      if (essay) {
        essayFullText = essay.content ?? '';
        // Try the verified prompt first (richer text), fall back to the
        // free-form `prompt` column.
        if (essay.essayPromptId) {
          const ep = await this.prisma.essayPrompt.findUnique({
            where: { id: essay.essayPromptId },
            select: { prompt: true },
          });
          prompt = ep?.prompt ?? essay.prompt ?? null;
        } else {
          prompt = essay.prompt ?? null;
        }
        // Class 1: user-owned essays carry an optional schoolId.
        if (essay.schoolId) {
          const school = await this.prisma.school.findUnique({
            where: { id: essay.schoolId },
            select: {
              name: true,
              nameZh: true,
              usNewsRank: true,
              acceptanceRate: true,
            },
          });
          if (school) {
            schoolPayload = {
              name: school.name,
              nameZh: school.nameZh ?? null,
              usNewsRank: school.usNewsRank ?? null,
              acceptanceRate: school.acceptanceRate
                ? Number(school.acceptanceRate)
                : null,
            };
          }
        }
        // Class 5 — user drafts have no result; leave null.
      }
    }

    // ─── Class 2: profile snapshot ──────────────────────────────────────
    // For a gallery debate we use the snapshot stored on `AdmissionCase`
    // itself (already anonymised). For a user-draft debate we use the
    // debating user's own profile.
    let profile: DebateContext['profile'] = null;
    if (session.admissionCaseId && hasGalleryCase) {
      profile = await this.loadCaseProfileSnapshot(session.admissionCaseId);
    } else if (session.essayId) {
      profile = await this.loadUserProfileSnapshot(session.userId);
    }

    // ─── Split essay into paragraphs (the prompt builder uses indices) ──
    const paragraphs = essayFullText
      ? essayFullText
          .split(/\n\n+/)
          .map((p) => p.trim())
          .filter((p) => p.length > 0)
      : [];
    const wordCount = essayFullText
      ? essayFullText.split(/\s+/).filter((w) => w.length > 0).length
      : 0;

    // ─── debateHistory — strip out the just-written user turn (the
    //     orchestrator appends it AFTER loading context, so this is
    //     just whatever was already on the session row). Cap to 6.
    const trimmedHistory = existingTurns.slice(-6).map((t) => ({
      role: t.role,
      text: t.text,
    }));

    return {
      school: schoolPayload,
      profile,
      essay: {
        fullText: essayFullText,
        paragraphs,
        wordCount,
        targetedParagraphIndex: paragraphIndex,
      },
      prompt,
      result: resultClass,
      priorCommentary,
      debateHistory: trimmedHistory,
    };
  }

  // ── private helpers ────────────────────────────────────────────────────

  /**
   * Map `AdmissionCase.aiAnalysisCache[locale].payload.paragraphs[idx]`
   * into the prompt's `priorCommentary` shape, picking the requested
   * paragraph (or the first paragraph if none requested).
   */
  private pickParagraphFromCache(
    cache: Prisma.JsonValue,
    locale: 'zh' | 'en',
    paragraphIndex: number | null,
  ): DebateContext['priorCommentary'] {
    if (!cache || typeof cache !== 'object' || Array.isArray(cache))
      return null;
    const blob = (cache as Record<string, unknown>)[locale] as
      CachedAnalysisEntry | undefined;
    const paragraphsCommentary = blob?.payload?.paragraphs;
    if (
      !Array.isArray(paragraphsCommentary) ||
      paragraphsCommentary.length === 0
    ) {
      return null;
    }
    const target =
      paragraphIndex != null
        ? (paragraphsCommentary.find(
            (p) => p?.paragraphIndex === paragraphIndex,
          ) ??
          paragraphsCommentary[paragraphIndex] ??
          paragraphsCommentary[0])
        : paragraphsCommentary[0];
    if (!target) return null;
    return {
      paragraphIndex:
        typeof target.paragraphIndex === 'number'
          ? target.paragraphIndex
          : (paragraphIndex ?? 0),
      score: typeof target.score === 'number' ? target.score : 5,
      status: typeof target.status === 'string' ? target.status : 'good',
      comment: typeof target.comment === 'string' ? target.comment : '',
      highlights: Array.isArray(target.highlights)
        ? target.highlights.filter((h): h is string => typeof h === 'string')
        : [],
      suggestions: Array.isArray(target.suggestions)
        ? target.suggestions.filter((s): s is string => typeof s === 'string')
        : [],
    };
  }

  /**
   * Profile-snapshot loader for gallery debates. Reads the anonymised
   * fields on `AdmissionCase`, surfacing GPA + top activities + top award.
   */
  private async loadCaseProfileSnapshot(
    caseId: string,
  ): Promise<DebateContext['profile']> {
    // governance: parent-scoped — reads the snapshot of the case the session points at; assertDebatableTargets validated that id against CASE_PUBLIC_WHERE before the session was created
    const ac = await this.prisma.admissionCase.findUnique({
      where: { id: caseId },
      select: {
        gpaRange: true,
        gpa11: true,
        gpa12: true,
        gpaScale: true,
        satRange: true,
        actRange: true,
        activities: true,
        awards: true,
        activityList: true,
      },
    });
    if (!ac) return null;

    const gpa = ac.gpa11 ?? ac.gpa12 ?? null;
    const gpaScale = ac.gpaScale ?? null;

    const topActivities = this.extractTopActivities(
      ac.activities,
      ac.activityList,
    );
    const topAward = this.extractTopAward(ac.awards);

    return {
      gpa,
      gpaScale,
      satRange: ac.satRange ?? null,
      actRange: ac.actRange ?? null,
      targetMajor: null,
      topActivities,
      topAward,
    };
  }

  /** Profile-snapshot loader for user-draft debates (debating user's profile). */
  private async loadUserProfileSnapshot(
    userId: string,
  ): Promise<DebateContext['profile']> {
    const p = await this.prisma.profile.findUnique({
      where: { userId },
      select: {
        gpa: true,
        gpaScale: true,
        targetMajor: true,
        activities: {
          orderBy: { order: 'asc' },
          take: 3,
          select: { name: true, role: true, hoursPerWeek: true },
        },
        awards: {
          orderBy: { order: 'asc' },
          take: 1,
          select: { name: true, level: true },
        },
      },
    });
    if (!p) return null;
    const topActivities = (p.activities ?? []).map((a) =>
      a.role ? `${a.name} (${a.role})` : a.name,
    );
    const topAward = p.awards?.[0]
      ? `${p.awards[0].name}${p.awards[0].level ? ` · ${p.awards[0].level}` : ''}`
      : null;
    return {
      gpa: p.gpa ? Number(p.gpa) : null,
      gpaScale: p.gpaScale ? Number(p.gpaScale) : null,
      satRange: null,
      actRange: null,
      targetMajor: p.targetMajor ?? null,
      topActivities,
      topAward,
    };
  }

  /** Best-effort extractor for case activities (3 top). */
  private extractTopActivities(
    activities: Prisma.JsonValue | null,
    activityList: string | null,
  ): string[] {
    if (Array.isArray(activities)) {
      return activities
        .slice(0, 3)
        .map((a) => {
          if (typeof a !== 'object' || a === null) return null;
          const obj = a as Record<string, unknown>;
          const desc =
            typeof obj.description === 'string' ? obj.description : null;
          const cat = typeof obj.category === 'string' ? obj.category : null;
          if (desc && cat) return `${cat} — ${desc}`;
          return desc ?? cat ?? null;
        })
        .filter((a): a is string => Boolean(a));
    }
    if (activityList) {
      return activityList
        .split(/\n|;/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .slice(0, 3);
    }
    return [];
  }

  /** Best-effort extractor for case top award. */
  private extractTopAward(awards: Prisma.JsonValue | null): string | null {
    if (!Array.isArray(awards) || awards.length === 0) return null;
    const a = awards[0];
    if (typeof a !== 'object' || a === null) return null;
    const obj = a as Record<string, unknown>;
    const name = typeof obj.name === 'string' ? obj.name : null;
    const level = typeof obj.level === 'string' ? obj.level : null;
    if (!name) return null;
    return level ? `${name} · ${level}` : name;
  }
}
