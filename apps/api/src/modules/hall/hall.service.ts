import { Injectable } from '@nestjs/common';
import { Review, UserList } from '@prisma/client';
import {
  PaginationDto,
  PaginatedResponseDto,
} from '../../common/dto/pagination.dto';
import { VerifiedRankingQueryDto, VerifiedRankingResponseDto } from './dto';
import { HallRankingService } from './hall-ranking.service';
import { HallReviewService } from './hall-review.service';
import { HallListService } from './hall-list.service';
import { HallVerifiedService } from './hall-verified.service';
import type {
  RankingResult,
  PublicProfileResponse,
} from './hall-ranking.service';

@Injectable()
export class HallService {
  constructor(
    private readonly ranking: HallRankingService,
    private readonly reviews: HallReviewService,
    private readonly lists: HallListService,
    private readonly verified: HallVerifiedService,
  ) {}

  // ============================================
  // Public Profiles
  // ============================================

  getPublicProfiles(
    search?: string,
    page?: number,
    pageSize?: number,
  ): Promise<{
    data: PublicProfileResponse[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    return this.ranking.getPublicProfiles(search, page, pageSize);
  }

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
  // Reviews
  // ============================================

  createReview(reviewerId: string, data: any): Promise<Review> {
    return this.reviews.createReview(reviewerId, data);
  }

  updateReview(
    reviewId: string,
    reviewerId: string,
    data: any,
  ): Promise<Review> {
    return this.reviews.updateReview(reviewId, reviewerId, data);
  }

  deleteReview(reviewId: string, reviewerId: string): Promise<void> {
    return this.reviews.deleteReview(reviewId, reviewerId);
  }

  getReviewsForUser(profileUserId: string, options?: any) {
    return this.reviews.getReviewsForUser(profileUserId, options);
  }

  getReviewStats(profileUserId: string) {
    return this.reviews.getReviewStats(profileUserId);
  }

  reactToReview(reviewId: string, userId: string, type: string) {
    return this.reviews.reactToReview(reviewId, userId, type);
  }

  removeReaction(reviewId: string, userId: string, type: string) {
    return this.reviews.removeReaction(reviewId, userId, type);
  }

  getReviewsForUserLegacy(profileUserId: string): Promise<Review[]> {
    return this.reviews.getReviewsForUserLegacy(profileUserId);
  }

  getMyReviews(reviewerId: string): Promise<Review[]> {
    return this.reviews.getMyReviews(reviewerId);
  }

  /** @deprecated Use getReviewStats instead */
  getAverageScores(profileUserId: string) {
    return this.reviews.getAverageScores(profileUserId);
  }

  // ============================================
  // Lists
  // ============================================

  createList(userId: string, data: any): Promise<UserList> {
    return this.lists.createList(userId, data);
  }

  updateList(listId: string, userId: string, data: any): Promise<UserList> {
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
