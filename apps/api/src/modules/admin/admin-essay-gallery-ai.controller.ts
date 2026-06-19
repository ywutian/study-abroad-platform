import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { RequirePermission, Roles } from '../../common/decorators';
import { Permission } from '../../common/constants/permissions';
import { EssayGalleryService } from '../essay/essay-gallery.service';

@ApiTags('Admin - Essay Gallery AI')
@ApiBearerAuth()
@Controller('admin/essay-gallery-ai')
@Roles(Role.OPERATOR)
export class AdminEssayGalleryAIController {
  constructor(private readonly essayGalleryService: EssayGalleryService) {}

  @Get('metrics')
  @RequirePermission(Permission.DATA_HEALTH)
  @ApiOperation({ summary: 'Get public essay gallery AI quality metrics' })
  @ApiQuery({
    name: 'from',
    required: false,
    description: 'Optional ISO date lower bound for interaction metrics',
  })
  @ApiQuery({
    name: 'to',
    required: false,
    description: 'Optional ISO date upper bound for interaction metrics',
  })
  getMetrics(@Query('from') from?: string, @Query('to') to?: string) {
    return this.essayGalleryService.getAdminGalleryAiMetrics({ from, to });
  }
}
