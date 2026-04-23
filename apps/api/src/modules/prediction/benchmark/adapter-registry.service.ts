import { Injectable, NotFoundException } from '@nestjs/common';
import { existsSync } from 'fs';
import { PrismaService } from '../../../prisma/prisma.service';
import type { CompetitorSourceSummary } from '@study-abroad/shared';
import { getSessionStoragePath } from './benchmark.config';
import type { RegisteredCompetitorAdapter } from './adapters/competitor-adapter.interface';
import { CollegeVineAdapter } from './adapters/collegevine.adapter';
import { MockCompetitorAdapter } from './adapters/mock-competitor.adapter';
import { SampleCompetitorAdapter } from './adapters/sample-competitor.adapter';

@Injectable()
export class AdapterRegistryService {
  private readonly adapters: RegisteredCompetitorAdapter[];

  constructor(
    private readonly prisma: PrismaService,
    mockAdapter: MockCompetitorAdapter,
    sampleAdapter: SampleCompetitorAdapter,
    collegeVineAdapter: CollegeVineAdapter,
  ) {
    this.adapters = [mockAdapter, sampleAdapter, collegeVineAdapter];
  }

  async ensureSourcesSynced(): Promise<void> {
    await Promise.all(
      this.adapters.map((adapter) =>
        this.prisma.competitorSource.upsert({
          where: { key: adapter.key },
          update: {
            label: adapter.label,
            baseUrl: adapter.baseUrl,
            supportsNumericProbability:
              adapter.supportsNumericProbability ?? true,
          },
          create: {
            key: adapter.key,
            label: adapter.label,
            baseUrl: adapter.baseUrl,
            enabled: adapter.defaultEnabled ?? true,
            supportsNumericProbability:
              adapter.supportsNumericProbability ?? true,
          },
        }),
      ),
    );
  }

  getAdapterOrThrow(sourceKey: string): RegisteredCompetitorAdapter {
    const adapter = this.adapters.find((item) => item.key === sourceKey);
    if (!adapter) {
      throw new NotFoundException(`Competitor adapter ${sourceKey} not found`);
    }
    return adapter;
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

  async listSources(): Promise<CompetitorSourceSummary[]> {
    await this.ensureSourcesSynced();
    const sources = await this.prisma.competitorSource.findMany({
      where: { key: { in: this.adapters.map((adapter) => adapter.key) } },
      orderBy: { label: 'asc' },
    });

    return sources.map((source) => {
      const adapter = this.getAdapterOrThrow(source.key);
      return {
        id: source.id,
        key: source.key,
        label: source.label,
        baseUrl: source.baseUrl,
        enabled: source.enabled,
        hasSession:
          adapter.requiresSession === false
            ? true
            : this.hasSession(source.key),
        supportsNumericProbability: source.supportsNumericProbability,
      };
    });
  }

  hasSession(sourceKey: string): boolean {
    return existsSync(getSessionStoragePath(sourceKey));
  }
}
