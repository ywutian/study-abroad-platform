import { PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsBoolean,
  IsOptional,
  MaxLength,
  IsObject,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';

export class CreateFeatureFlagDto {
  @ApiProperty({ example: 'prediction-v4' })
  @IsString()
  @MaxLength(200)
  key: string;

  @ApiPropertyOptional({ example: 'Enable prediction v4 algorithm' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @ApiPropertyOptional({
    example: { roles: ['ADMIN'], userIds: [], percentage: 100 },
    description:
      'Targeting rules: roles (whitelist), userIds (whitelist), percentage (0-100 gradual rollout)',
  })
  @IsObject()
  @IsOptional()
  rules?: Prisma.InputJsonValue;
}

export class UpdateFeatureFlagDto extends PartialType(CreateFeatureFlagDto) {}
