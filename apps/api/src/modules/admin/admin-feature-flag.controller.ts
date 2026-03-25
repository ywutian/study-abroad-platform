import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { FeatureFlagService } from '../../common/feature-flags/feature-flag.service';
import {
  CreateFeatureFlagDto,
  UpdateFeatureFlagDto,
} from '../../common/feature-flags/dto/feature-flag.dto';

@ApiTags('Admin - Feature Flags')
@Controller('admin/feature-flags')
@Roles(Role.ADMIN)
export class AdminFeatureFlagController {
  constructor(private readonly featureFlagService: FeatureFlagService) {}

  @Get()
  @ApiOperation({ summary: 'List all feature flags' })
  findAll() {
    return this.featureFlagService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a feature flag by ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const flag = await this.featureFlagService.findById(id);
    if (!flag) {
      throw new NotFoundException('Feature flag not found');
    }
    return flag;
  }

  @Post()
  @ApiOperation({ summary: 'Create a new feature flag' })
  create(@Body() dto: CreateFeatureFlagDto) {
    return this.featureFlagService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a feature flag' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFeatureFlagDto,
  ) {
    return this.featureFlagService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a feature flag' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.featureFlagService.remove(id);
  }

  @Post(':id/invalidate-cache')
  @ApiOperation({ summary: 'Force invalidate the Redis cache for a flag' })
  async invalidateCache(@Param('id', ParseUUIDPipe) id: string) {
    const flag = await this.featureFlagService.findById(id);
    if (!flag) {
      throw new NotFoundException('Feature flag not found');
    }
    await this.featureFlagService.invalidateCache(flag.key);
    return { invalidated: true };
  }
}
