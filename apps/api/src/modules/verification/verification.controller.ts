import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
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
import { RolesGuard } from '../../common/guards/roles.guard';
import { Role } from '@prisma/client';

@ApiTags('verification')
@ApiBearerAuth()
@Controller('verification')
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @Post()
  @ApiOperation({ summary: '提交认证申请' })
  @ApiResponse({ status: 201, description: '认证申请已提交' })
  async submitVerification(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateVerificationDto
  ) {
    return this.verificationService.submitVerification(user.id, dto);
  }

  @Get('my')
  @ApiOperation({ summary: '获取我的认证申请' })
  async getMyVerifications(@CurrentUser() user: CurrentUserPayload) {
    return this.verificationService.getMyVerifications(user.id);
  }

  @Get('pending')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '获取待审核的认证申请（管理员）' })
  async getPendingVerifications(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string
  ) {
    return this.verificationService.getPendingVerifications(
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 20
    );
  }

  @Get('stats')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '获取认证统计（管理员）' })
  async getVerificationStats() {
    return this.verificationService.getVerificationStats();
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '获取认证详情（管理员）' })
  async getVerificationDetail(@Param('id') id: string) {
    return this.verificationService.getVerificationDetail(id);
  }

  @Post(':id/review')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '审核认证申请（管理员）' })
  @ApiResponse({ status: 200, description: '审核完成' })
  async reviewVerification(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: ReviewVerificationDto
  ) {
    return this.verificationService.reviewVerification(id, user.id, dto);
  }
}



