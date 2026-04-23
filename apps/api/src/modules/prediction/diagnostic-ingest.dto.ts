import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class DiagIngestCasesDto {
  @ApiProperty({
    required: false,
    description: 'CSV content for real admission cases',
  })
  @IsOptional()
  @IsString()
  @MaxLength(5 * 1024 * 1024)
  csv?: string;

  @ApiProperty({ required: false, description: 'Preview without writing' })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}
