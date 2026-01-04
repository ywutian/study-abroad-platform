import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface PredictionFactor {
  name: string;
  impact: 'positive' | 'negative' | 'neutral';
  detail: string;
}

export interface PredictionResult {
  schoolId: string;
  schoolName: string;
  probability: number;
  factors: PredictionFactor[];
}

@Injectable()
export class PredictionService {
  constructor(private prisma: PrismaService) {}

  // Placeholder for prediction algorithm
  // This will be replaced with AI-based prediction later
  async predict(profileId: string, schoolIds: string[]): Promise<PredictionResult[]> {
    const profile = await this.prisma.profile.findUnique({
      where: { id: profileId },
      include: {
        testScores: true,
        activities: true,
        awards: true,
      },
    });

    if (!profile) {
      return [];
    }

    const schools = await this.prisma.school.findMany({
      where: { id: { in: schoolIds } },
    });

    // Mock prediction results
    // In real implementation, this would call AI service or use ML model
    return schools.map((school) => ({
      schoolId: school.id,
      schoolName: school.name,
      probability: this.mockPrediction(profile, school),
      factors: this.mockFactors(profile, school),
    }));
  }

  private mockPrediction(profile: any, school: any): number {
    // Simple mock based on GPA and school acceptance rate
    let base = 0.5;

    if (profile.gpa) {
      const gpa = Number(profile.gpa);
      if (gpa >= 3.9) base += 0.2;
      else if (gpa >= 3.7) base += 0.1;
      else if (gpa < 3.0) base -= 0.2;
    }

    if (school.acceptanceRate) {
      const rate = Number(school.acceptanceRate);
      // Lower acceptance rate = harder to get in
      base -= (1 - rate / 100) * 0.3;
    }

    // Clamp between 0.05 and 0.95
    return Math.max(0.05, Math.min(0.95, base));
  }

  private mockFactors(profile: any, school: any): PredictionFactor[] {
    const factors: PredictionFactor[] = [];

    if (profile.gpa) {
      const gpa = Number(profile.gpa);
      if (gpa >= 3.7) {
        factors.push({
          name: 'GPA',
          impact: 'positive',
          detail: `Your GPA (${gpa.toFixed(2)}) is competitive for this school`,
        });
      } else if (gpa < 3.0) {
        factors.push({
          name: 'GPA',
          impact: 'negative',
          detail: `Your GPA (${gpa.toFixed(2)}) is below average for this school`,
        });
      }
    }

    if (profile.testScores?.length > 0) {
      factors.push({
        name: 'Test Scores',
        impact: 'positive',
        detail: 'You have standardized test scores on file',
      });
    } else {
      factors.push({
        name: 'Test Scores',
        impact: 'neutral',
        detail: 'No test scores on file',
      });
    }

    if (profile.activities?.length >= 5) {
      factors.push({
        name: 'Activities',
        impact: 'positive',
        detail: `Strong extracurricular involvement (${profile.activities.length} activities)`,
      });
    }

    if (profile.awards?.length > 0) {
      factors.push({
        name: 'Awards',
        impact: 'positive',
        detail: `${profile.awards.length} achievement(s) on record`,
      });
    }

    return factors;
  }

  // Save prediction results
  async savePrediction(profileId: string, schoolId: string, probability: number, factors: PredictionFactor[]): Promise<void> {
    await this.prisma.predictionResult.create({
      data: {
        profileId,
        schoolId,
        probability,
        factors: factors as object,
        modelVersion: 'mock-v1',
      },
    });
  }

  // Get user's prediction history
  async getPredictionHistory(profileId: string) {
    return this.prisma.predictionResult.findMany({
      where: { profileId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}

