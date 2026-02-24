/**
 * Forum Tools Service
 *
 * Tools: SEARCH_FORUM_POSTS, GET_POPULAR_DISCUSSIONS, ANSWER_FORUM_QUESTION
 */

import { Injectable, Logger } from '@nestjs/common';
import { AiService } from '../../ai/ai.service';
import { ForumService } from '../../forum/forum.service';
import { ToolHandler, IToolHandlerProvider } from './tool-handler.interface';

@Injectable()
export class ForumToolsService implements IToolHandlerProvider {
  private readonly logger = new Logger(ForumToolsService.name);

  constructor(
    private aiService: AiService,
    private forumService: ForumService,
  ) {}

  getHandlers(): Map<string, ToolHandler> {
    return new Map([
      [
        'search_forum_posts',
        (args, _userId, _ctx, locale) =>
          this.searchForumPosts(args.query, args.category, args.limit, locale),
      ],
      [
        'get_popular_discussions',
        (args, _userId, _ctx, locale) =>
          this.getPopularDiscussions(args.category, args.timeRange, locale),
      ],
      [
        'answer_forum_question',
        (args, _userId, _ctx, locale) =>
          this.answerForumQuestion(args.question, args.context, locale),
      ],
    ]);
  }

  async searchForumPosts(
    query: string,
    category?: string,
    limit?: number,
    locale = 'zh',
  ) {
    try {
      const result = await this.forumService.getPosts(null, {
        search: query,
        categoryId: category,
        limit: limit || 10,
        offset: 0,
      });

      return {
        count: result.total,
        posts: result.posts.map((p) => ({
          id: p.id,
          title: p.title,
          content:
            p.content.substring(0, 200) + (p.content.length > 200 ? '...' : ''),
          author: p.author.name || (locale === 'zh' ? '匿名用户' : 'Anonymous'),
          isVerified: p.author.isVerified,
          category:
            locale === 'zh'
              ? p.category?.nameZh || p.category?.name
              : p.category?.name || p.category?.nameZh,
          tags: p.tags,
          likeCount: p.likeCount,
          commentCount: p.commentCount,
          createdAt: p.createdAt,
        })),
      };
    } catch (error) {
      this.logger.error('Failed to search forum posts', error);
      return {
        error:
          locale === 'zh' ? '搜索论坛帖子失败' : 'Failed to search forum posts',
      };
    }
  }

  async getPopularDiscussions(
    category?: string,
    _timeRange?: string,
    locale = 'zh',
  ) {
    try {
      const result = await this.forumService.getPosts(null, {
        categoryId: category,
        sortBy: 'popular' as any,
        limit: 10,
        offset: 0,
      });

      return {
        count: result.total,
        discussions: result.posts.map((p) => ({
          id: p.id,
          title: p.title,
          summary: p.content.substring(0, 150) + '...',
          category:
            locale === 'zh'
              ? p.category?.nameZh || p.category?.name
              : p.category?.name || p.category?.nameZh,
          likeCount: p.likeCount,
          commentCount: p.commentCount,
          isTeamPost: p.isTeamPost,
        })),
      };
    } catch (error) {
      this.logger.error('Failed to get popular discussions', error);
      return {
        error:
          locale === 'zh'
            ? '获取热门讨论失败'
            : 'Failed to get popular discussions',
      };
    }
  }

  async answerForumQuestion(question: string, context?: string, locale = 'zh') {
    const isZh = locale === 'zh';
    const systemPrompt = isZh
      ? `你是专业的留学顾问，负责回答学生关于留学申请的问题。

回答要求：
1. 准确、专业、有帮助
2. 如果不确定，诚实说明并建议寻求专业人士帮助
3. 适当引用相关资源或建议进一步阅读
4. 用中文回答`
      : `You are a professional admissions consultant answering student questions about college applications.

Requirements:
1. Be accurate, professional, and helpful
2. If unsure, be honest and suggest seeking professional guidance
3. Reference relevant resources when appropriate
4. Respond in English`;

    const response = await this.aiService.chat(
      [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: isZh
            ? `问题：${question}${context ? `\n背景：${context}` : ''}`
            : `Question: ${question}${context ? `\nContext: ${context}` : ''}`,
        },
      ],
      { temperature: 0.5 },
    );

    return {
      question,
      answer: response,
      disclaimer: isZh
        ? '以上回答仅供参考，具体情况请咨询专业顾问或学校官方。'
        : 'This answer is for reference only. Please consult a professional counselor or the school directly for specific situations.',
    };
  }
}
