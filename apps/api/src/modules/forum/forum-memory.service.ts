import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MemoryManagerService } from '../ai-agent/memory/memory-manager.service';
import { MemoryType } from '@prisma/client';
import { CreatePostDto } from './dto';

@Injectable()
export class ForumMemoryService {
  private readonly logger = new Logger(ForumMemoryService.name);

  constructor(
    private prisma: PrismaService,
    @Optional()
    private memoryManager?: MemoryManagerService,
  ) {}

  /**
   * 保存帖子信息到记忆系统
   */
  async savePostToMemory(
    userId: string,
    categoryName: string,
    data: CreatePostDto,
  ): Promise<void> {
    if (!this.memoryManager) return;

    try {
      if (data.isTeamPost) {
        // 组队帖记录为决策
        await this.memoryManager.remember(userId, {
          type: MemoryType.DECISION,
          category: 'team_post',
          content: `用户发起组队：${data.title}。要求：${data.requirements?.slice(0, 100) || '无'}。组队规模：${data.teamSize || '未限制'}人`,
          importance: 0.6,
          metadata: {
            postTitle: data.title,
            teamSize: data.teamSize,
            tags: data.tags,
            source: 'forum_service',
          },
        });
      } else {
        // 普通帖子记录感兴趣的话题
        await this.memoryManager.remember(userId, {
          type: MemoryType.PREFERENCE,
          category: 'forum_interest',
          content: `用户在论坛 ${categoryName} 板块发帖：${data.title}。标签：${data.tags?.join('、') || '无'}`,
          importance: 0.4,
          metadata: {
            categoryId: data.categoryId,
            tags: data.tags,
            source: 'forum_service',
          },
        });
      }
    } catch (error) {
      this.logger.warn('Failed to save forum post to memory', error);
    }
  }

  /**
   * 记录浏览帖子到记忆系统
   */
  async recordViewToMemory(userId: string, post: any): Promise<void> {
    if (!this.memoryManager) return;

    try {
      await this.memoryManager.remember(userId, {
        type: MemoryType.FACT,
        category: 'forum_view',
        content: `用户浏览了论坛帖子：${post.title}${post.isTeamPost ? '（组队帖）' : ''}`,
        importance: 0.2,
        metadata: {
          postId: post.id,
          isTeamPost: post.isTeamPost,
          categoryId: post.categoryId,
          tags: post.tags,
        },
      });
    } catch (error) {
      this.logger.warn('Failed to record view to memory', error);
    }
  }

  /**
   * 记录点赞到记忆系统
   */
  async recordLikeToMemory(userId: string, postId: string): Promise<void> {
    if (!this.memoryManager) return;

    try {
      const post = await this.prisma.forumPost.findUnique({
        where: { id: postId },
        select: { title: true, tags: true, isTeamPost: true },
      });

      if (post) {
        await this.memoryManager.remember(userId, {
          type: MemoryType.PREFERENCE,
          category: 'forum_interest',
          content: `用户点赞了帖子：${post.title}。标签：${post.tags?.join('、') || '无'}`,
          importance: 0.3,
          metadata: {
            postId,
            tags: post.tags,
            isTeamPost: post.isTeamPost,
          },
        });
      }
    } catch (error) {
      this.logger.warn('Failed to record like to memory', error);
    }
  }

  /**
   * 记录评论到记忆系统
   */
  async recordCommentToMemory(
    userId: string,
    postId: string,
    content: string,
  ): Promise<void> {
    if (!this.memoryManager) return;

    try {
      const post = await this.prisma.forumPost.findUnique({
        where: { id: postId },
        select: { title: true, tags: true },
      });

      if (post) {
        await this.memoryManager.remember(userId, {
          type: MemoryType.FACT,
          category: 'forum_activity',
          content: `用户在帖子"${post.title}"下发表了评论`,
          importance: 0.3,
          metadata: {
            postId,
            commentPreview: content.slice(0, 100),
            tags: post.tags,
          },
        });
      }
    } catch (error) {
      this.logger.warn('Failed to record comment to memory', error);
    }
  }

  /**
   * 记录组队申请到记忆系统
   */
  async recordTeamApplicationToMemory(
    userId: string,
    postTitle: string,
    message?: string,
  ): Promise<void> {
    if (!this.memoryManager) return;

    try {
      await this.memoryManager.remember(userId, {
        type: MemoryType.DECISION,
        category: 'team_application',
        content: `用户申请加入组队：${postTitle}${message ? `，留言：${message.slice(0, 50)}` : ''}`,
        importance: 0.6,
        metadata: {
          postTitle,
          message,
          source: 'forum_service',
        },
      });
    } catch (error) {
      this.logger.warn('Failed to record team application to memory', error);
    }
  }
}
