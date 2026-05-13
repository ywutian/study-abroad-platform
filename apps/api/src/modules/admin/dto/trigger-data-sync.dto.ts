import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsObject, MaxLength } from 'class-validator';

export class TriggerDataSyncDto {
  @ApiPropertyOptional({ example: 'COLLEGE_SCORECARD' })
  @IsString()
  @MaxLength(200)
  job!: string;

  @ApiPropertyOptional({
    description:
      'Job-specific params, e.g. { limit: 500 } or { limit: 100, dryRun: true, onlyMissing: true }',
    example: { limit: 500 },
  })
  @IsOptional()
  @IsObject()
  params?: Record<string, number | string | boolean>;
}
