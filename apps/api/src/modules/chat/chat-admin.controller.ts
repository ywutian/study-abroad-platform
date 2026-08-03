import { Controller, Get, Delete, Param, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { Roles, RequirePermission } from '../../common/decorators';
import { Role } from '@prisma/client';
import { Permission } from '../../common/constants/permissions';
import { ThrottleRelaxed } from '../../common/decorators/throttle.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('admin/chats')
@ApiBearerAuth()
@ThrottleRelaxed()
@Controller('admin/chats')
@Roles(Role.OPERATOR)
@RequirePermission(Permission.CONTENT_MODERATE)
export class ChatAdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('conversations')
  @ApiOperation({ summary: 'Admin view all conversations' })
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
      // governance: admin-scope — whole controller is @Roles(Role.OPERATOR) + @RequirePermission(CONTENT_MODERATE) — moderating other people's conversations is the purpose
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
      // governance: admin-scope — whole controller is @Roles(Role.OPERATOR) + @RequirePermission(CONTENT_MODERATE) — moderating other people's conversations is the purpose
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
  @ApiOperation({ summary: 'Admin view messages of a specific conversation' })
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
      // governance: admin-scope — whole controller is @Roles(Role.OPERATOR) + @RequirePermission(CONTENT_MODERATE) — moderating other people's conversations is the purpose
      this.prisma.message.findMany({
        where: { conversationId },
        skip: (p - 1) * ps,
        take: ps,
        orderBy: { createdAt: 'desc' },
        include: {
          sender: { select: { id: true, email: true, role: true } },
        },
      }),
      // governance: admin-scope — whole controller is @Roles(Role.OPERATOR) + @RequirePermission(CONTENT_MODERATE) — moderating other people's conversations is the purpose
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
  @ApiOperation({ summary: 'Admin delete message' })
  async deleteMessage(@Param('id') id: string) {
    // governance: admin-scope — whole controller is @Roles(Role.OPERATOR) + @RequirePermission(CONTENT_MODERATE) — moderating other people's conversations is the purpose
    await this.prisma.message.delete({
      where: { id },
    });
    return { message: 'Message deleted' };
  }
}
