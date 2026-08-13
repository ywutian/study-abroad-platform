import { Injectable } from '@nestjs/common';
import { UserList } from '@prisma/client';
import {
  PaginationDto,
  PaginatedResponseDto,
} from '../../common/dto/pagination.dto';
import {
  CreateUserListDto,
  VerifiedRankingQueryDto,
  VerifiedRankingResponseDto,
} from './dto';
import { HallRankingService } from './hall-ranking.service';
import { HallListService } from './hall-list.service';
import { HallVerifiedService } from './hall-verified.service';
import type { RankingResult } from './hall-ranking.service';

@Injectable()
export class HallService {
  constructor(
    private readonly ranking: HallRankingService,
    private readonly lists: HallListService,
    private readonly verified: HallVerifiedService,
  ) {}

  // ============================================
  // Ranking
  // ============================================

  getBatchRanking(
    userId: string,
    schoolIds: string[],
    locale?: string,
  ): Promise<{ rankings: RankingResult[] }> {
    return this.ranking.getBatchRanking(userId, schoolIds, locale);
  }

  getProfileRanking(userId: string, schoolId: string) {
    return this.ranking.getProfileRanking(userId, schoolId);
  }

  getTargetSchoolRanking(userId: string) {
    return this.ranking.getTargetSchoolRanking(userId);
  }

  getRankingAnalysis(userId: string, schoolId: string, locale?: string) {
    return this.ranking.getRankingAnalysis(userId, schoolId, locale);
  }

  // ============================================
  // Lists
  // ============================================

  createList(userId: string, data: CreateUserListDto): Promise<UserList> {
    return this.lists.createList(userId, data);
  }

  updateList(
    listId: string,
    userId: string,
    data: Partial<CreateUserListDto>,
  ): Promise<UserList> {
    return this.lists.updateList(listId, userId, data);
  }

  deleteList(listId: string, userId: string): Promise<void> {
    return this.lists.deleteList(listId, userId);
  }

  getPublicLists(
    pagination: PaginationDto,
    category?: string,
  ): Promise<PaginatedResponseDto<UserList>> {
    return this.lists.getPublicLists(pagination, category);
  }

  getMyLists(userId: string): Promise<UserList[]> {
    return this.lists.getMyLists(userId);
  }

  getListById(listId: string): Promise<UserList> {
    return this.lists.getListById(listId);
  }

  voteList(listId: string, userId: string, value: 1 | -1) {
    return this.lists.voteList(listId, userId, value);
  }

  removeVote(listId: string, userId: string) {
    return this.lists.removeVote(listId, userId);
  }

  getListVoteCount(listId: string): Promise<number> {
    return this.lists.getListVoteCount(listId);
  }

  // ============================================
  // Verified Ranking
  // ============================================

  getVerifiedRanking(
    query: VerifiedRankingQueryDto,
  ): Promise<VerifiedRankingResponseDto> {
    return this.verified.getVerifiedRanking(query);
  }

  getAvailableYears(): Promise<number[]> {
    return this.verified.getAvailableYears();
  }
}
