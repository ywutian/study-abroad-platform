import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateNotificationPreferencesDto {
  @ApiPropertyOptional({
    description: 'Show readiness prompts on first-party in-app surfaces.',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  readinessInAppSurface?: boolean;

  @ApiPropertyOptional({
    description:
      'Allow readiness prompts in the Redis-backed notification feed.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  readinessRedisNotificationFeed?: boolean;

  @ApiPropertyOptional({
    description: 'Allow readiness remote push nudges.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  readinessRemotePush?: boolean;

  @ApiPropertyOptional({
    description: 'Allow readiness email nudges.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  readinessEmail?: boolean;
}
