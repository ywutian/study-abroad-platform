import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../../prisma/prisma.service';
import { CreateBenchmarkCommentDto, ListBenchmarkRunsDto } from './dto';

const COMMENT_AUTHOR_SELECT = {
  id: true,
  email: true,
  role: true,
  // nickname lives on Profile (not User); fetched as a nested select so the
  // UI can show a friendly display name without leaking realName.
  profile: { select: { nickname: true } },
} as const satisfies Prisma.UserSelect;

const RUN_SUMMARY_SELECT = {
  id: true,
  ranAt: true,
  label: true,
  engineVersion: true,
  testsPassed: true,
  testsTotal: true,
  summary: true,
  notes: true,
  _count: { select: { comments: true } },
} as const satisfies Prisma.PredictionBenchmarkRunSelect;

const RUN_DETAIL_SELECT = {
  id: true,
  ranAt: true,
  label: true,
  engineVersion: true,
  testsPassed: true,
  testsTotal: true,
  summary: true,
  tests: true,
  cases: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} as const satisfies Prisma.PredictionBenchmarkRunSelect;

export type BenchmarkRunSummary = Prisma.PredictionBenchmarkRunGetPayload<{
  select: typeof RUN_SUMMARY_SELECT;
}>;

export type BenchmarkRunDetail = Prisma.PredictionBenchmarkRunGetPayload<{
  select: typeof RUN_DETAIL_SELECT;
}>;

export interface BenchmarkRunWithComments extends BenchmarkRunDetail {
  comments: Array<{
    id: string;
    body: string;
    anchor: string | null;
    createdAt: Date;
    author: {
      id: string;
      email: string;
      role: string;
      profile: { nickname: string | null } | null;
    };
  }>;
}

/**
 * Read-only service for the admin prediction-benchmark surface.
 *
 * Benchmark runs are seeded by `scripts/seed-prediction-benchmark.ts` (run by
 * an engineer after local M3 structural + v3-case runs). The admin UI lists
 * runs, opens one for detail, and lets multiple admins post review comments.
 * There is no in-UI "run benchmark" button — runs are produced by the engineer
 * outside the request/response cycle (benchmarks read the local CDS/School
 * tables which the production API process doesn't have direct access to in
 * the same shape the standalone script expects).
 *
 * A single `PredictionBenchmarkRun.tests` array now contains both the 7
 * structural property tests and the 20 L0 golden fixtures (added 2026-05-23).
 * Fixture entries are prefixed `Fixture X.Y (...)` so reviewers can tell them
 * apart in the existing UI list. See `docs/PREDICTION_BENCHMARK_TEST_SPEC.md`
 * for the full spec.
 */
@Injectable()
export class PredictionBenchmarkService {
  private readonly logger = new Logger(PredictionBenchmarkService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listRuns(query: ListBenchmarkRunsDto) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));

    const [total, runs] = await this.prisma.$transaction([
      this.prisma.predictionBenchmarkRun.count(),
      this.prisma.predictionBenchmarkRun.findMany({
        select: RUN_SUMMARY_SELECT,
        orderBy: { ranAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      runs,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async getLatestRun(): Promise<BenchmarkRunWithComments | null> {
    const latest = await this.prisma.predictionBenchmarkRun.findFirst({
      orderBy: { ranAt: 'desc' },
      select: { id: true },
    });
    if (!latest) return null;
    return this.getRun(latest.id);
  }

  async getRun(id: string): Promise<BenchmarkRunWithComments> {
    const run = await this.prisma.predictionBenchmarkRun.findUnique({
      where: { id },
      select: {
        ...RUN_DETAIL_SELECT,
        comments: {
          select: {
            id: true,
            body: true,
            anchor: true,
            createdAt: true,
            author: { select: COMMENT_AUTHOR_SELECT },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!run) {
      throw new NotFoundException(`Benchmark run ${id} not found`);
    }
    return run;
  }

  async addComment(
    runId: string,
    authorId: string,
    dto: CreateBenchmarkCommentDto,
  ) {
    // Validate run exists (foreign key would also catch this but we want a
    // clean 404 instead of an FK violation 500).
    const run = await this.prisma.predictionBenchmarkRun.findUnique({
      where: { id: runId },
      select: { id: true },
    });
    if (!run) {
      throw new NotFoundException(`Benchmark run ${runId} not found`);
    }

    const created = await this.prisma.predictionBenchmarkComment.create({
      data: {
        runId,
        authorId,
        body: dto.body.trim(),
        anchor: dto.anchor?.trim() || null,
      },
      select: {
        id: true,
        body: true,
        anchor: true,
        createdAt: true,
        author: { select: COMMENT_AUTHOR_SELECT },
      },
    });
    this.logger.log(
      `Benchmark comment added: runId=${runId} authorId=${authorId} anchor=${created.anchor ?? '(root)'}`,
    );
    return created;
  }

  async deleteComment(commentId: string, requesterUserId: string) {
    const comment = await this.prisma.predictionBenchmarkComment.findUnique({
      where: { id: commentId },
      select: { authorId: true },
    });
    if (!comment) {
      throw new NotFoundException(`Comment ${commentId} not found`);
    }
    if (comment.authorId !== requesterUserId) {
      // Service-level guard: only the author can delete; admins are routed
      // via the same endpoint but only when they're the author. (We
      // intentionally don't let arbitrary admins delete others' comments
      // — for a co-review surface that erases history fast.)
      throw new NotFoundException(`Comment ${commentId} not found`);
    }
    await this.prisma.predictionBenchmarkComment.delete({
      where: { id: commentId },
    });
    return { deleted: true };
  }
}
