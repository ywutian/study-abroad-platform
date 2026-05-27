import { Injectable, Logger } from '@nestjs/common';
import type { PredictionBlocker } from '@study-abroad/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { ProfileCrudService } from './profile-crud.service';
import {
  evaluatePredictionEligibility,
  hasGpaSignal,
} from './prediction-eligibility.util';

/**
 * Handles profile grade calculation and analysis.
 */
@Injectable()
export class ProfileAnalysisService {
  private readonly logger = new Logger(ProfileAnalysisService.name);

  constructor(
    private prisma: PrismaService,
    private crudService: ProfileCrudService,
  ) {}

  /**
   * Calculate a holistic profile grade (0-100) with strengths/weaknesses analysis.
   *
   * Scoring breakdown (base 50, max 100):
   * - GPA: +15 (>=90th percentile) or +10 (>=75th percentile)
   * - SAT: +10 (>=1400) or +5 (any score)
   * - TOEFL: +5 (>=100)
   * - Activities: +10 (>=5 activities) or +2 per activity
   * - Awards: +10 (>=3 awards) or +3 per award
   *
   * Also returns an admission prediction label, improvement suggestions,
   * recommended activities, a timeline, and projected improvement delta.
   *
   * @param userId - The user identifier
   * @returns Comprehensive grade object with score, strengths, weaknesses, and action items
   */
  async calculateProfileGrade(userId: string): Promise<{
    overallScore: number;
    admissionPrediction: string;
    strengths: string[];
    weaknesses: string[];
    improvements: string[];
    recommendedActivities: string[];
    timeline: Array<{ date: string; task: string }>;
    projectedImprovement: number;
  }> {
    const profile = await this.crudService.findByUserId(userId);

    let overallScore = 50; // Base score
    const strengths: string[] = [];
    const weaknesses: string[] = [];

    if (profile) {
      // GPA contribution
      if (profile.gpa) {
        const gpaPercent =
          (Number(profile.gpa) / Number(profile.gpaScale ?? 4)) * 100;
        if (gpaPercent >= 90) {
          overallScore += 15;
          strengths.push('Excellent GPA above 3.6');
        } else if (gpaPercent >= 75) {
          overallScore += 10;
          strengths.push('Good GPA above 3.0');
        } else {
          weaknesses.push('GPA could be improved');
        }
      } else {
        weaknesses.push('GPA not recorded');
      }

      // Test scores
      const testScores = (profile as any).testScores || [];
      const satScore = testScores.find((t: any) => t.type === 'SAT');
      const toeflScore = testScores.find((t: any) => t.type === 'TOEFL');

      if (satScore && satScore.score >= 1400) {
        overallScore += 10;
        strengths.push(`Strong SAT score: ${satScore.score}`);
      } else if (satScore) {
        overallScore += 5;
      }

      if (toeflScore && toeflScore.score >= 100) {
        overallScore += 5;
        strengths.push(`TOEFL score above 100: ${toeflScore.score}`);
      }

      // Activities
      const activities = (profile as any).activities || [];
      if (activities.length >= 5) {
        overallScore += 10;
        strengths.push(
          `Diverse extracurricular involvement (${activities.length} activities)`,
        );
      } else if (activities.length > 0) {
        overallScore += activities.length * 2;
      } else {
        weaknesses.push('No extracurricular activities recorded');
      }

      // Awards
      const awards = (profile as any).awards || [];
      if (awards.length >= 3) {
        overallScore += 10;
        strengths.push(`Multiple awards and recognitions (${awards.length})`);
      } else if (awards.length > 0) {
        overallScore += awards.length * 3;
      }
    }

    // Cap score at 100
    overallScore = Math.min(100, overallScore);

    return {
      overallScore,
      admissionPrediction:
        overallScore >= 80
          ? 'Strong candidate for top universities'
          : overallScore >= 60
            ? 'Competitive applicant with room for improvement'
            : 'Building a strong profile - focus on key areas',
      strengths,
      weaknesses,
      improvements: [
        'Consider adding research experience',
        'Participate in leadership positions in your activities',
        'Pursue academic competitions in your field of interest',
      ],
      recommendedActivities: [
        'Join summer research programs at local universities',
        'Start a project or initiative related to your intended major',
        'Seek internship opportunities in your field',
      ],
      timeline: [
        { date: '3 months', task: 'Complete standardized testing' },
        { date: '6 months', task: 'Start college essays' },
        { date: '9 months', task: 'Finalize school list and applications' },
      ],
      projectedImprovement: Math.min(20, 100 - overallScore),
    };
  }

  /**
   * Calculate profile completeness score (0-100) with per-section breakdown.
   *
   * Sections and max points:
   * - basics (20): nickname, bio, grade, nationality
   * - academics (25): gpa, currentSchool, currentSchoolType, targetMajor, educationSystem
   * - testing (20): at least one test score, SAT, TOEFL
   * - activities (15): activities list (1pt each, max 15)
   * - preferences (10): budgetTier, regionPref, applicationRound, needsFinancialAid
   * - demographics (10): countryOfResidence, citizenship, firstGeneration
   */
  async calculateCompleteness(userId: string): Promise<{
    score: number;
    sections: Record<
      string,
      { score: number; maxScore: number; missing: string[] }
    >;
    /** Whether the profile may run an admission prediction (SSOT predicate). */
    canRunPrediction: boolean;
    /** Specific reasons `canRunPrediction` is false; empty when eligible. */
    predictionBlockers: PredictionBlocker[];
  }> {
    const [profile, schoolListCount] = await Promise.all([
      this.prisma.profile.findUnique({
        where: { userId },
        include: {
          testScores: true,
          activities: true,
          semesterGpas: { select: { id: true } },
        },
      }),
      this.prisma.schoolListItem.count({ where: { userId } }),
    ]);

    // Prediction eligibility — shared SSOT predicate, also used by
    // `/profiles/me/readiness` and the `POST /predictions` 412 backstop.
    const eligibility = evaluatePredictionEligibility({
      hasGpa: hasGpaSignal(profile),
      hasBasicInfo: !!(profile?.targetMajor || profile?.grade),
      schoolListCount,
    });

    const sections: Record<
      string,
      { score: number; maxScore: number; missing: string[] }
    > = {
      basics: { score: 0, maxScore: 20, missing: [] },
      academics: { score: 0, maxScore: 25, missing: [] },
      testing: { score: 0, maxScore: 20, missing: [] },
      activities: { score: 0, maxScore: 15, missing: [] },
      preferences: { score: 0, maxScore: 10, missing: [] },
      demographics: { score: 0, maxScore: 10, missing: [] },
    };

    if (!profile) {
      // All fields missing
      for (const s of Object.values(sections)) {
        s.missing.push('Profile not created');
      }
      return {
        score: 0,
        sections,
        canRunPrediction: eligibility.canRunPrediction,
        predictionBlockers: eligibility.blockers,
      };
    }

    // Basics (20 pts)
    const basicsChecks: [string, unknown, number][] = [
      ['nickname', profile.nickname, 5],
      ['bio', profile.bio, 5],
      ['grade', profile.grade, 5],
      ['nationality', profile.nationality, 5],
    ];
    for (const [name, value, pts] of basicsChecks) {
      if (value) sections.basics.score += pts;
      else sections.basics.missing.push(name);
    }

    // Academics (25 pts)
    const academicsChecks: [string, unknown, number][] = [
      ['gpa', profile.gpa, 7],
      ['currentSchool', profile.currentSchool, 5],
      ['currentSchoolType', profile.currentSchoolType, 3],
      ['targetMajor', profile.targetMajor, 5],
      ['educationSystem', profile.educationSystem, 5],
    ];
    for (const [name, value, pts] of academicsChecks) {
      if (value) sections.academics.score += pts;
      else sections.academics.missing.push(name);
    }

    // Testing (20 pts)
    const testScores = profile.testScores || [];
    if (testScores.length > 0) {
      sections.testing.score += 8; // at least one score
      if (testScores.some((t) => t.type === 'SAT' || t.type === 'ACT'))
        sections.testing.score += 6;
      else sections.testing.missing.push('SAT/ACT');
      if (
        testScores.some(
          (t) =>
            t.type === 'TOEFL' || t.type === 'IELTS' || t.type === 'DUOLINGO',
        )
      )
        sections.testing.score += 6;
      else sections.testing.missing.push('TOEFL/IELTS/Duolingo');
    } else {
      sections.testing.missing.push('testScores');
    }

    // Activities (15 pts, 1pt each up to 15)
    const activities = profile.activities || [];
    sections.activities.score = Math.min(15, activities.length);
    if (activities.length === 0) sections.activities.missing.push('activities');
    else if (activities.length < 5)
      sections.activities.missing.push(
        `only ${activities.length} activities (recommend 5+)`,
      );

    // Preferences (10 pts)
    const prefChecks: [string, unknown, number][] = [
      ['budgetTier', profile.budgetTier, 3],
      ['regionPref', profile.regionPref?.length > 0 ? true : null, 3],
      ['applicationRound', profile.applicationRound, 2],
      [
        'needsFinancialAid',
        profile.needsFinancialAid !== null ? true : null,
        2,
      ],
    ];
    for (const [name, value, pts] of prefChecks) {
      if (value) sections.preferences.score += pts;
      else sections.preferences.missing.push(name);
    }

    // Demographics (10 pts)
    const demoChecks: [string, unknown, number][] = [
      ['countryOfResidence', profile.countryOfResidence, 4],
      ['citizenship', profile.citizenship, 3],
      ['firstGeneration', true, 3], // boolean field, always filled (default false)
    ];
    for (const [name, value, pts] of demoChecks) {
      if (value) sections.demographics.score += pts;
      else sections.demographics.missing.push(name);
    }

    const totalScore = Object.values(sections).reduce(
      (sum, s) => sum + s.score,
      0,
    );

    return {
      score: totalScore,
      sections,
      canRunPrediction: eligibility.canRunPrediction,
      predictionBlockers: eligibility.blockers,
    };
  }
}
