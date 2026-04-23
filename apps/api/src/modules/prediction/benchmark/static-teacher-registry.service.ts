import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CampusReelStaticAdapter } from './adapters/campusreel-static.adapter';
import type { StaticTeacher } from './static-teacher.interface';

@Injectable()
export class StaticTeacherRegistryService {
  private readonly teachers: StaticTeacher[];

  constructor(
    private readonly prisma: PrismaService,
    campusReelStatic: CampusReelStaticAdapter,
  ) {
    this.teachers = [campusReelStatic];
  }

  async ensureSourcesSynced(): Promise<void> {
    await Promise.all(
      this.teachers.map((teacher) =>
        this.prisma.competitorSource.upsert({
          where: { key: teacher.key },
          update: {
            label: teacher.label,
            baseUrl: teacher.baseUrl,
            supportsNumericProbability:
              teacher.supportsNumericProbability ?? true,
          },
          create: {
            key: teacher.key,
            label: teacher.label,
            baseUrl: teacher.baseUrl,
            enabled: teacher.defaultEnabled ?? false,
            supportsNumericProbability:
              teacher.supportsNumericProbability ?? true,
          },
        }),
      ),
    );
  }

  getTeacherOrThrow(sourceKey: string): StaticTeacher {
    const teacher = this.teachers.find((item) => item.key === sourceKey);
    if (!teacher) {
      throw new NotFoundException(`Static teacher ${sourceKey} not found`);
    }
    return teacher;
  }

  async getSourceOrThrow(sourceKey: string) {
    await this.ensureSourcesSynced();
    const source = await this.prisma.competitorSource.findUnique({
      where: { key: sourceKey },
    });
    if (!source) {
      throw new NotFoundException(`Competitor source ${sourceKey} not found`);
    }
    return source;
  }
}
