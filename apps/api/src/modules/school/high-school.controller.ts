import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { ThrottleSensitive } from '../../common/decorators/throttle.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { HighSchoolService } from './high-school.service';
import { HighSchoolType } from '@prisma/client';
import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class SuggestHighSchoolDto {
  @ApiProperty({ maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @ApiProperty({ maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  country: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;
}

@ApiTags('High Schools')
@Controller('high-schools')
export class HighSchoolController {
  constructor(private readonly highSchoolService: HighSchoolService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Search high school reference data' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'country', required: false })
  @ApiQuery({ name: 'type', required: false, enum: HighSchoolType })
  @ApiQuery({ name: 'tier', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  async search(
    @Query('search') search?: string,
    @Query('country') country?: string,
    @Query('type') type?: HighSchoolType,
    @Query('tier') tier?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.highSchoolService.search({
      search,
      country,
      type,
      tier: tier ? parseInt(tier, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    });
  }

  @Post('suggest')
  @ThrottleSensitive()
  @ApiOperation({ summary: 'Suggest a new high school to be added' })
  async suggest(
    @Body() dto: SuggestHighSchoolDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.highSchoolService.submitSuggestion(dto, user.id);
  }
}
