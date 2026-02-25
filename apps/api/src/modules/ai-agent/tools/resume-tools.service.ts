/**
 * Resume Tools Service
 *
 * Tools: GET_RESUME_LIST, GET_RESUME_DETAILS, REVIEW_RESUME,
 *        OPTIMIZE_RESUME_BULLETS, SUGGEST_RESUME_CONTENT
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ResumeService } from '../../resume/resume.service';
import { ToolHandler, IToolHandlerProvider } from './tool-handler.interface';

@Injectable()
export class ResumeToolsService implements IToolHandlerProvider {
  private readonly logger = new Logger(ResumeToolsService.name);

  constructor(
    private prisma: PrismaService,
    private resumeService: ResumeService,
  ) {}

  getHandlers(): Map<string, ToolHandler> {
    const handlers = new Map<string, ToolHandler>();
    handlers.set('get_resume_list', (_args, userId, _ctx, _locale) =>
      this.getResumeList(userId),
    );
    handlers.set('get_resume_details', (args, userId, _ctx, _locale) =>
      this.getResumeDetails(args, userId),
    );
    handlers.set('review_resume', (args, userId, _ctx, _locale) =>
      this.reviewResume(args, userId),
    );
    handlers.set('optimize_resume_bullets', (args, userId, _ctx, _locale) =>
      this.optimizeBullets(args, userId),
    );
    handlers.set('suggest_resume_content', (args, userId, _ctx, _locale) =>
      this.suggestContent(args, userId),
    );
    return handlers;
  }

  private async getResumeList(userId: string) {
    const resumes = await this.prisma.resume.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        type: true,
        status: true,
        templateId: true,
        language: true,
        updatedAt: true,
        _count: { select: { sections: true } },
      },
    });

    if (resumes.length === 0) {
      return { message: '暂无简历，请先创建简历', count: 0 };
    }

    return {
      count: resumes.length,
      resumes: resumes.map((r) => ({
        id: r.id,
        title: r.title,
        type: r.type,
        status: r.status,
        templateId: r.templateId,
        language: r.language,
        sectionCount: r._count.sections,
        updatedAt: r.updatedAt,
      })),
    };
  }

  private async getResumeDetails(args: Record<string, any>, userId: string) {
    const resumeId = args.resumeId as string | undefined;
    let resume;

    if (resumeId) {
      resume = await this.prisma.resume.findFirst({
        where: { id: resumeId, userId },
        include: { sections: { orderBy: { order: 'asc' } } },
      });
    } else {
      resume = await this.prisma.resume.findFirst({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        include: { sections: { orderBy: { order: 'asc' } } },
      });
    }

    if (!resume) {
      return { error: '未找到简历' };
    }

    return {
      id: resume.id,
      title: resume.title,
      type: resume.type,
      status: resume.status,
      templateId: resume.templateId,
      language: resume.language,
      sections: resume.sections.map((s) => ({
        id: s.id,
        type: s.type,
        title: s.title,
        isVisible: s.isVisible,
        content: s.content,
      })),
    };
  }

  private async reviewResume(args: Record<string, any>, userId: string) {
    return this.resumeService.aiReview(
      userId,
      args.resumeId as string,
      args.targetSchool as string | undefined,
      args.targetMajor as string | undefined,
    );
  }

  private async optimizeBullets(args: Record<string, any>, userId: string) {
    return this.resumeService.aiOptimizeBullets(
      userId,
      args.resumeId as string,
      args.sectionId as string,
      args.itemId as string | undefined,
      args.targetSchool as string | undefined,
      args.targetMajor as string | undefined,
    );
  }

  private async suggestContent(args: Record<string, any>, userId: string) {
    return this.resumeService.aiSuggestContent(
      userId,
      args.resumeId as string,
      args.sectionType as string,
      args.targetMajor as string | undefined,
    );
  }
}
