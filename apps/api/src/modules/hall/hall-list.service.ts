import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Optional,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { fireAndForget } from '../../common/utils/async.util';
import { UserList, Prisma, MemoryType } from '@prisma/client';
import {
  PaginationDto,
  createPaginatedResponse,
  PaginatedResponseDto,
} from '../../common/dto/pagination.dto';
import { stripListOwner } from './hall.constants';
import { MemoryManagerService } from '../ai-agent/memory/memory-manager.service';
import { PointsService, PointAction } from '../points/incentive.service';

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value));
}

interface CreateUserListDto {
  title: string;
  description?: string;
  category?: string;
  items: unknown[];
  isPublic?: boolean;
}

@Injectable()
export class HallListService {
  private readonly logger = new Logger(HallListService.name);

  constructor(
    private prisma: PrismaService,
    private pointsService: PointsService,
    @Optional() private memoryManager?: MemoryManagerService,
  ) {}

  async createList(userId: string, data: CreateUserListDto): Promise<UserList> {
    const list = await this.prisma.userList.create({
      data: {
        userId,
        title: data.title,
        description: data.description,
        category: data.category,
        items: toInputJson(data.items),
        isPublic: data.isPublic ?? true,
      },
    });

    fireAndForget(
      this.recordCreateListToMemory(userId, data),
      this.logger,
      'Failed to record create list to memory',
    );

    // Hall refactor Phase 1: award CASE_STUDY_COMPLETE for curating a list.
    // Once Lists → "Expert curated lists" lands (Stage 2), this reward will be
    // reserved for admin/editor curated entries.
    fireAndForget(
      this.pointsService.adjustPoints(userId, PointAction.CASE_STUDY_COMPLETE, {
        listId: list.id,
        source: 'create_list',
      }),
      this.logger,
      'Failed to award list creation points',
    );

    return list;
  }

  async updateList(
    listId: string,
    userId: string,
    data: Partial<CreateUserListDto>,
  ): Promise<UserList> {
    const list = await this.prisma.userList.findUnique({
      where: { id: listId },
    });

    if (!list || list.userId !== userId) {
      throw new NotFoundException('List not found');
    }

    return this.prisma.userList.update({
      where: { id: listId },
      data: {
        title: data.title,
        description: data.description,
        category: data.category,
        items: data.items === undefined ? undefined : toInputJson(data.items),
        isPublic: data.isPublic,
      },
    });
  }

  async deleteList(listId: string, userId: string): Promise<void> {
    const list = await this.prisma.userList.findUnique({
      where: { id: listId },
    });

    if (!list || list.userId !== userId) {
      throw new NotFoundException('List not found');
    }

    await this.prisma.userList.delete({ where: { id: listId } });
  }

  async getPublicLists(
    pagination: PaginationDto,
    category?: string,
  ): Promise<PaginatedResponseDto<UserList>> {
    const { page = 1, pageSize = 20 } = pagination;
    const skip = (page - 1) * pageSize;

    const where: Prisma.UserListWhereInput = { isPublic: true };
    if (category) {
      where.category = category;
    }

    const [lists, total] = await Promise.all([
      // governance: public-feed — filters `isPublic: true` — the list owner chose to publish
      this.prisma.userList.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          // The creator relation is gone, not narrowed: nothing displays a
          // list's creator, and `{ select: { id: true } }` was handing over
          // the forum join key. stripListOwner removes the `userId` scalar
          // that `include` leaves behind.
          _count: { select: { votes: true } },
        },
      }),
      // governance: public-feed — filters `isPublic: true` — the list owner chose to publish
      this.prisma.userList.count({ where }),
    ]);

    return createPaginatedResponse(
      lists.map(stripListOwner),
      total,
      page,
      pageSize,
    );
  }

  async getMyLists(userId: string): Promise<UserList[]> {
    return this.prisma.userList.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { votes: true } },
      },
    });
  }

  async getListById(listId: string): Promise<UserList> {
    // governance: public-feed — filters `isPublic` since 52ebf249; before that this @Public() route returned private lists to anyone holding an id
    const list = await this.prisma.userList.findUnique({
      where: { id: listId },
      include: {
        // See getPublicLists: the creator relation is gone and the `userId`
        // scalar is stripped below.
        _count: { select: { votes: true } },
      },
    });

    // `isPublic` is the access control on this route, and it was missing.
    // GET /halls/lists/:id is @Public() — unauthenticated — so without this
    // check anyone holding an id could read a list its owner had marked
    // private, while getPublicLists() right above filters on `isPublic: true`
    // and voteList() right below rejects the same rows. Only this reader was
    // skipped. 404 rather than 403: a private list should not confirm it
    // exists. Owners read their own lists through getMyLists().
    if (!list || !list.isPublic) {
      throw new NotFoundException('List not found');
    }

    return stripListOwner(list);
  }

  async voteList(listId: string, userId: string, value: 1 | -1) {
    const list = await this.prisma.userList.findUnique({
      where: { id: listId },
    });
    if (!list || !list.isPublic) {
      throw new NotFoundException('List not found');
    }

    if (list.userId === userId) {
      throw new BadRequestException('Cannot vote on your own list');
    }

    const vote = await this.prisma.userListVote.upsert({
      where: { listId_userId: { listId, userId } },
      update: { value },
      create: { listId, userId, value },
    });

    if (value === 1) {
      this.recordVoteToMemory(userId, list.title, list.category).catch(
        (err) => {
          this.logger.warn('Failed to record vote to memory', err);
        },
      );
    }

    return vote;
  }

  async removeVote(listId: string, userId: string) {
    await this.prisma.userListVote.deleteMany({
      where: { listId, userId },
    });
  }

  async getListVoteCount(listId: string): Promise<number> {
    // governance: aggregate-only — sums vote values for one list and returns a single integer — no rows, no identities. No small-sample floor and none needed: the figure is a score, not an outcome attributable to a person. Currently has no controller route at all
    const result = await this.prisma.userListVote.aggregate({
      where: { listId },
      _sum: { value: true },
    });
    return result._sum.value || 0;
  }

  private async recordCreateListToMemory(
    userId: string,
    data: CreateUserListDto,
  ): Promise<void> {
    if (!this.memoryManager) return;

    try {
      await this.memoryManager.remember(userId, {
        type: MemoryType.DECISION,
        category: 'list_creation',
        content: `用户创建了榜单：${data.title}${data.category ? `（分类：${data.category}）` : ''}`,
        importance: 0.5,
        metadata: {
          title: data.title,
          category: data.category,
          isPublic: data.isPublic,
          itemCount: data.items?.length || 0,
        },
      });
    } catch (error) {
      this.logger.warn('Failed to record create list to memory', error);
    }
  }

  private async recordVoteToMemory(
    userId: string,
    listTitle: string,
    category?: string | null,
  ): Promise<void> {
    if (!this.memoryManager) return;

    try {
      await this.memoryManager.remember(userId, {
        type: MemoryType.PREFERENCE,
        category: 'list_interest',
        content: `用户点赞了榜单：${listTitle}${category ? `（分类：${category}）` : ''}`,
        importance: 0.3,
        metadata: {
          listTitle,
          category: category ?? undefined,
        },
      });
    } catch (error) {
      this.logger.warn('Failed to record vote to memory', error);
    }
  }
}
