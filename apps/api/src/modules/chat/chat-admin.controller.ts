import { Controller, Get, Delete, Param, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('admin/chats')
@ApiBearerAuth()
@Controller('admin/chats')
@Roles(Role.ADMIN)
export class ChatAdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('conversations')
  @ApiOperation({ summary: '管理员查看所有会话' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiQuery({ name: 'search', required: false })
  async getConversations(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('search') search?: string,
  ) {
    const p = Number(page) || 1;
    const ps = Number(pageSize) || 20;

    const where: any = {};
    // Optionally filter by participant email
    if (search) {
      where.participants = {
        some: {
          user: {
            email: { contains: search, mode: 'insensitive' },
          },
        },
      };
    }

    const [conversations, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where,
        skip: (p - 1) * ps,
        take: ps,
        orderBy: { updatedAt: 'desc' },
        include: {
          participants: {
            include: {
              user: { select: { id: true, email: true, role: true } },
            },
          },
          _count: { select: { messages: true } },
        },
      }),
      this.prisma.conversation.count({ where }),
    ]);

    return {
      data: conversations,
      total,
      page: p,
      pageSize: ps,
      totalPages: Math.ceil(total / ps),
    };
  }

  @Get('conversations/:id/messages')
  @ApiOperation({ summary: '管理员查看指定会话的消息' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  async getMessages(
    @Param('id') conversationId: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    const p = Number(page) || 1;
    const ps = Number(pageSize) || 50;

    const [messages, total] = await Promise.all([
      this.prisma.message.findMany({
        where: { conversationId },
        skip: (p - 1) * ps,
        take: ps,
        orderBy: { createdAt: 'desc' },
        include: {
          sender: { select: { id: true, email: true, role: true } },
        },
      }),
      this.prisma.message.count({ where: { conversationId } }),
    ]);

    return {
      data: messages,
      total,
      page: p,
      pageSize: ps,
      totalPages: Math.ceil(total / ps),
    };
  }

  @Delete('messages/:id')
  @ApiOperation({ summary: '管理员删除消息' })
  async deleteMessage(@Param('id') id: string) {
    await this.prisma.message.delete({
      where: { id },
    });
    return { message: 'Message deleted' };
  }
}
