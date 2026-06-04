import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { VerificationService } from './verification.service';
import { CreateVerificationDto, ReviewVerificationDto } from './dto';
import { CurrentUser, Roles } from '../../common/decorators';
import type { CurrentUserPayload } from '../../common/decorators';
import {
  ThrottleStrict,
  ThrottleRelaxed,
} from '../../common/decorators/throttle.decorator';
import { Role } from '@prisma/client';

@ApiTags('verification')
@ApiBearerAuth()
@ThrottleStrict()
@Controller('verifications')
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @Post()
  @ApiOperation({ summary: 'Submit verification application' })
  @ApiResponse({
    status: 201,
    description: 'Verification application submitted',
  })
  async submitVerification(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateVerificationDto,
  ) {
    return this.verificationService.submitVerification(user.id, dto);
  }

  @Get('my')
  @ApiOperation({ summary: 'Get my verification applications' })
  async getMyVerifications(@CurrentUser() user: CurrentUserPayload) {
    return this.verificationService.getMyVerifications(user.id);
  }

  @Get('pending')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get pending verification applications (admin)' })
  async getPendingVerifications(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.verificationService.getPendingVerifications(
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 20,
    );
  }

  @Get('stats')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get verification statistics (admin)' })
  async getVerificationStats() {
    return this.verificationService.getVerificationStats();
  }

  // NOTE: must stay above `@Get(':id')` so the static path wins route matching.
  // Not admin-only and read-heavy (polled on every profile load) → relax the
  // controller-level ThrottleStrict so normal usage isn't rate-limited.
  @Get('status')
  @ThrottleRelaxed()
  @ApiOperation({ summary: 'Get my verification status (email + identity)' })
  async getVerificationStatus(@CurrentUser() user: CurrentUserPayload) {
    return this.verificationService.getVerificationStatus(user.id);
  }

  @Get(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get verification details (admin)' })
  async getVerificationDetail(@Param('id') id: string) {
    return this.verificationService.getVerificationDetail(id);
  }

  @Post(':id/review')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Review verification application (admin)' })
  @ApiResponse({ status: 200, description: 'Review completed' })
  async reviewVerification(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: ReviewVerificationDto,
  ) {
    return this.verificationService.reviewVerification(id, user.id, dto);
  }
}
