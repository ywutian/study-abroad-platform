import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ProfileCrudService } from './profile-crud.service';

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
}
